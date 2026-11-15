-- Run once in the Supabase SQL Editor. No database password is needed in the app.
begin;
create table public.profiles (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 name text not null check (length(trim(name)) between 1 and 100),
 age integer check (age between 0 and 130),
 revision integer not null default 0,
 extras jsonb not null default '{"activity":[],"moods":{},"settings":{"overdue":true,"escalation":true},"checkIns":{}}',
 created_at timestamptz not null default now()
);
create table public.care_circle_members (
 profile_id uuid not null references public.profiles(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 display_name text not null,
 role text not null check (role in ('owner','editor','viewer')),
 primary key (profile_id,user_id)
);
create table public.medications (
 id uuid primary key,
 profile_id uuid not null references public.profiles(id) on delete cascade,
 name text not null, dose text not null, time time not null,
 instructions text not null default '',
 color text not null check (color in ('white','blue','pink','yellow','green','orange')),
 shape text not null check (shape in ('round','oval','capsule')),
 size text not null check (size in ('Small','Large')),
 unique (profile_id,id)
);
create table public.dose_logs (
 profile_id uuid not null references public.profiles(id) on delete cascade,
 medication_id uuid not null,
 dose_date date not null,
 status text not null check (status in ('taken','skipped')),
 recorded_at timestamptz not null default now(),
 primary key (profile_id, medication_id, dose_date),
 foreign key (profile_id,medication_id) references public.medications(profile_id,id) on delete cascade
);
create table public.appointments (
 id uuid primary key,
 profile_id uuid not null references public.profiles(id) on delete cascade,
 doctor text not null, date date not null, time time not null,
 location text not null, notes text not null default ''
);
create index medications_profile on public.medications(profile_id);
create index appointments_profile on public.appointments(profile_id);
create index members_user on public.care_circle_members(user_id);

-- SECURITY DEFINER avoids recursive membership policies. Only returns access flags.
create function public.can_read_profile(pid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.profiles p where p.id=pid and p.owner_id=auth.uid())
 or exists(select 1 from public.care_circle_members m where m.profile_id=pid and m.user_id=auth.uid());
$$;
create function public.can_edit_profile(pid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.profiles p where p.id=pid and p.owner_id=auth.uid())
 or exists(select 1 from public.care_circle_members m where m.profile_id=pid and m.user_id=auth.uid() and m.role='editor');
$$;
alter table public.profiles enable row level security;
alter table public.care_circle_members enable row level security;
alter table public.medications enable row level security;
alter table public.dose_logs enable row level security;
alter table public.appointments enable row level security;
create policy profiles_read on public.profiles for select to authenticated using(public.can_read_profile(id));
create policy members_read on public.care_circle_members for select to authenticated using(public.can_read_profile(profile_id));
create policy medications_read on public.medications for select to authenticated using(public.can_read_profile(profile_id));
create policy doses_read on public.dose_logs for select to authenticated using(public.can_read_profile(profile_id));
create policy appointments_read on public.appointments for select to authenticated using(public.can_read_profile(profile_id));
-- Writes go through checked, transactional functions; direct writes are denied.
revoke all on public.profiles,public.care_circle_members,public.medications,public.dose_logs,public.appointments from anon,authenticated;
grant select on public.profiles,public.care_circle_members,public.medications,public.dose_logs,public.appointments to authenticated;

create function public.create_care_profile(profile_name text, profile_age integer, member_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare pid uuid;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 insert into public.profiles(owner_id,name,age) values(auth.uid(),trim(profile_name),profile_age) returning id into pid;
 insert into public.care_circle_members values(pid,auth.uid(),left(trim(member_name),100),'owner');
 return pid;
end;
$$;

create function public.save_care_profile(pid uuid, expected_revision integer, payload jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare current_revision integer; m jsonb; a jsonb; d record;
begin
 if not public.can_edit_profile(pid) then raise exception 'You do not have edit access'; end if;
 select revision into current_revision from public.profiles where id=pid for update;
 if current_revision <> expected_revision then raise exception 'Care profile changed on another device. Reload before editing.'; end if;
 -- Every change is one transaction. An invalid row rolls back the entire save.
 delete from public.dose_logs where profile_id=pid;
 delete from public.medications where profile_id=pid;
 delete from public.appointments where profile_id=pid;
 for m in select value from jsonb_array_elements(payload->'meds') loop
  insert into public.medications values((m->>'id')::uuid,pid,m->>'name',m->>'dose',(m->>'time')::time,coalesce(m->>'instructions',''),m->>'color',m->>'shape',m->>'size');
 end loop;
 for d in select key,value from jsonb_each(payload->'doses') loop
  if exists(select 1 from public.medications where id=substring(d.key from 12)::uuid and profile_id=pid) then
   insert into public.dose_logs values(pid,substring(d.key from 12)::uuid,left(d.key,10)::date,d.value->>'status',(d.value->>'at')::timestamptz);
  end if;
 end loop;
 for a in select value from jsonb_array_elements(payload->'appointments') loop
  insert into public.appointments values((a->>'id')::uuid,pid,a->>'doctor',(a->>'date')::date,(a->>'time')::time,a->>'location',coalesce(a->>'notes',''));
 end loop;
 update public.profiles set revision=revision+1,extras=jsonb_build_object('activity',payload->'activity','moods',payload->'moods','settings',payload->'settings','checkIns',payload->'checkIns') where id=pid;
 return current_revision+1;
end;
$$;
-- A single SQL statement reads the entire profile from one database snapshot.
create function public.load_care_profile(pid uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
 select jsonb_build_object(
  'profile',to_jsonb(p),
  'meds',coalesce((select jsonb_agg(to_jsonb(m)) from public.medications m where m.profile_id=p.id),'[]'::jsonb),
  'doses',coalesce((select jsonb_agg(to_jsonb(d)) from public.dose_logs d where d.profile_id=p.id),'[]'::jsonb),
  'appointments',coalesce((select jsonb_agg(to_jsonb(a)) from public.appointments a where a.profile_id=p.id),'[]'::jsonb),
  'members',coalesce((select jsonb_agg(to_jsonb(c)) from public.care_circle_members c where c.profile_id=p.id),'[]'::jsonb)
 ) from public.profiles p where p.id=pid;
$$;
revoke all on function public.load_care_profile(uuid) from public,anon;
grant execute on function public.load_care_profile(uuid) to authenticated;
revoke all on function public.can_read_profile(uuid),public.can_edit_profile(uuid),public.create_care_profile(text,integer,text),public.save_care_profile(uuid,integer,jsonb) from public,anon;
grant execute on function public.can_read_profile(uuid),public.can_edit_profile(uuid),public.create_care_profile(text,integer,text),public.save_care_profile(uuid,integer,jsonb) to authenticated;
commit;
