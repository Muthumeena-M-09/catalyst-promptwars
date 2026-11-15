// Supabase Auth and PostgREST use only the public project key plus the user's JWT.
// No database password or service-role key is sent to this application.
(() => {
 const stylesheet=document.createElement('link');stylesheet.rel='stylesheet';stylesheet.href='/cloud.css';document.head.append(stylesheet);
 const config=window.KINDRED_CONFIG || {};
 const configured=!!(config.url&&config.key);
 let session=null,profile=null,members=[],ready=false,saving=false,failed=false,queued=null,revision=0,authMode='login',refreshPromise=null;
 const emptyState=()=>({meds:[],doses:{},appointments:[],activity:[],moods:{},settings:{overdue:true,escalation:true},checkIns:{}});
 const authPanel=document.createElement('dialog');authPanel.id='auth-dialog';
 authPanel.innerHTML=`<form id="auth-form"><div class="dialog-heading"><div><div class="eyebrow">YOUR PRIVATE CARE SPACE</div><h2 id="auth-title">Welcome back.</h2></div><button class="close" type="button" data-close aria-label="Close">×</button></div><p class="muted" id="auth-intro">Sign in to access your care profiles across devices.</p><label>Email<input type="email" name="email" autocomplete="email" required></label><label>Password<input type="password" name="password" autocomplete="current-password" minlength="8" required></label><p id="auth-error" class="form-error" role="status"></p><button class="button primary full" id="auth-submit">Sign in</button><button type="button" class="text-button" id="auth-switch">New here? Create an account</button></form>`;
 document.body.append(authPanel);
 const setupPanel=document.createElement('dialog');setupPanel.id='profile-dialog';
 setupPanel.innerHTML=`<form id="profile-form"><div class="dialog-heading"><h2>Who are we caring for?</h2></div><p class="muted">Start with an empty care plan. Demo medications won’t be copied to your account.</p><label>Your name<input name="member" required maxlength="100" placeholder="Your name"></label><label>Person’s name<input name="name" required maxlength="100" placeholder="e.g. Eleanor Lewis"></label><label>Age<input name="age" type="number" min="0" max="130" required></label><p class="form-error" id="profile-error" role="status"></p><button class="button primary full">Create care profile</button><button type="button" class="text-button" id="setup-signout">Sign out</button></form>`;document.body.append(setupPanel);
 const tools=document.createElement('div');tools.className='cloud-controls';tools.innerHTML='<span id="sync-status" role="status"></span><select id="profile-select" aria-label="Care profile" hidden></select><button class="button outline" id="cloud-account">Sign in</button>';$('.header-right').prepend(tools);
 const status=text=>$('#sync-status').textContent=text;
 function setSession(data){session=data?.access_token?{...data,expires_at:data.expires_at||Math.floor(Date.now()/1000)+(data.expires_in||3600)}:null;if(session)sessionStorage.setItem('kindred-session',JSON.stringify(session));else sessionStorage.removeItem('kindred-session');}
 async function request(endpoint,{body,method='GET',authenticated=true}={}){
  if(authenticated){if(!session)throw new Error('Please sign in again.');if(session.expires_at<Date.now()/1000+60)await refresh();}
  const headers={apikey:config.key,'Content-Type':'application/json'};
  if(authenticated)headers.Authorization=`Bearer ${session.access_token}`;
  const response=await fetch(config.url.replace(/\/$/,'')+endpoint,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  const result=await response.json().catch(()=>null);
  if(!response.ok)throw new Error(result?.msg||result?.message||result?.error_description||result?.error||`Request failed (${response.status})`);
  return result;
 }
 async function refresh(){if(!refreshPromise)refreshPromise=request('/auth/v1/token?grant_type=refresh_token',{method:'POST',authenticated:false,body:{refresh_token:session.refresh_token}}).then(setSession).finally(()=>refreshPromise=null);return refreshPromise;}
 const rpc=(name,body)=>request(`/rest/v1/rpc/${name}`,{method:'POST',body});
 function decorate(){
  if(!configured)return;
  $('.local-badge').innerHTML='<i></i> Supabase';
  $('#cloud-account').textContent=session?'Sign out':'Sign in';
  $('.account strong').textContent=session?.user?.email||'Your care space';$('.account small').textContent=session?'Signed in':'Sign in to begin';
  if($('#reset-demo'))$('#reset-demo').hidden=true;
  if(!profile){$('.profile-banner').hidden=true;$('#page-content').innerHTML='<div class="card empty">'+(session?'Create or select a care profile to begin.':'Sign in to open your private care space.')+'</div>';return;}
  $('.profile-banner').hidden=false;
  $('.profile-main h2').textContent=profile.name;
  $('.portrait').innerHTML=escapeHTML(profile.name.split(/\s+/).map(n=>n[0]).slice(0,2).join('').toUpperCase())+'<span>♡</span>';
  $('.profile-main p').textContent=`${profile.age??'—'} years young · ${state.meds.filter(m=>dose(m)?.status==='taken').length} of ${state.meds.length} medications taken today`;
  const name=profile.name;
  $('#page-description').textContent={today:`Here’s how ${name}’s day is looking. You’re all in this together.`,medications:'Every medication, with a visual cue to make it a little easier.',appointments:'Keep the next visit close, and your questions closer.',circle:`The people showing up for ${name}, one small moment at a time.`,activity:'A shared record of check-ins, care, and everyday support.'}[page];
  const wellness=$('.wellness h3');if(wellness)wellness.textContent=`How are you feeling, ${name}?`;
  $('.circle-summary strong').textContent='Your circle of care';$('.circle-summary small').textContent=`${members.length} member${members.length===1?'':'s'} →`;
  $('.stack').innerHTML=members.slice(0,3).map(m=>`<span class="avatar sage">${escapeHTML(m.display_name.slice(0,2).toUpperCase())}</span>`).join('');
  if(page==='circle')$('#page-content').innerHTML=`<div class="circle-grid">${members.map(m=>`<div class="card person"><div class="avatar sage">${escapeHTML(m.display_name.slice(0,2).toUpperCase())}</div><h3>${escapeHTML(m.display_name)}</h3><p>${escapeHTML(m.role)}</p><span class="status taken">✓ Authorized member</span></div>`).join('')}</div><div class="notice">Membership is enforced by the database. Invite-code joining will be added next; the demo invite code does not grant access.</div>`;
  // Replace demo-only names in static supporting copy, never user-entered records.
  for(const el of document.querySelectorAll('.help-note,.check-in p,.schedule-footer'))if(el.textContent.includes('Eleanor')||el.textContent.includes('Jamie'))for(const node of [...el.childNodes])if(node.nodeType===Node.TEXT_NODE)node.textContent=node.textContent.replaceAll('Eleanor',name).replaceAll('Jamie','A care-circle member');
  $('footer span:last-child').textContent='Private account · Supabase storage · Email reminders not connected';
 }
 const baseRender=render;render=function(){baseRender();decorate();};
 async function loadProfile(id){
  ready=false;status('Loading…');
  const {profile:loaded,meds,doses,appointments,members:circle}=await rpc('load_care_profile',{pid:id});
  if(!loaded)throw new Error('This care profile is not available to your account.');
  profile=loaded;members=circle;revision=profile.revision;
  state={...emptyState(),...profile.extras,meds:meds.map(({profile_id,...m})=>({...m,time:m.time.slice(0,5)})),appointments:appointments.map(({profile_id,...a})=>({...a,time:a.time.slice(0,5)})),doses:Object.fromEntries(doses.map(d=>[`${d.dose_date}-${d.medication_id}`,{status:d.status,at:d.recorded_at}]))};
  ready=true;failed=false;render();status('Saved to Supabase');
 }
 async function loadAccount(){
  const profiles=await request('/rest/v1/profiles?select=id,name&order=created_at');
  const select=$('#profile-select');select.innerHTML=profiles.map(p=>`<option value="${p.id}">${escapeHTML(p.name)}</option>`).join('');select.hidden=profiles.length<2;
  if(profiles.length)await loadProfile(profiles[0].id);else{profile=null;state=emptyState();render();status('Create your care profile');setupPanel.showModal();}
 }
 async function flush(){
  if(saving||!queued||failed)return;saving=true;status('Saving…');
  try{while(queued){const snapshot=queued;queued=null;revision=await rpc('save_care_profile',{pid:profile.id,expected_revision:revision,payload:snapshot});}status('Saved to Supabase');}
  catch(error){queued=null;failed=true;ready=false;status('Save failed — reload');toast(`Changes were not saved: ${error.message}`);$('#sync-status').title=error.message;}
  finally{saving=false;}
 }
 window.careCloud={configured,save(value){if(!configured)return;if(!ready||failed){toast('Cloud changes are unavailable. Reload or sign in.');return;}queued=JSON.parse(JSON.stringify(value));flush();}};
 window.careCloud.personName=()=>profile?.name||'Eleanor';
 window.careCloud.memberName=()=>members.find(m=>m.user_id===session?.user?.id)?.display_name||'A care-circle member';
 $('#cloud-account').addEventListener('click',async()=>{if(!configured){toast('Copy .env.example to .env and add your publishable key, then restart the server.');return;}if(session){if(saving||queued)return toast('Please wait for your changes to finish saving.');try{await request('/auth/v1/logout',{method:'POST'});}catch{ /* Clear this device even when remote logout is unavailable. */ }setSession(null);ready=false;profile=null;members=[];state=emptyState();render();status('Signed out');}else authPanel.showModal();});
 $('#setup-signout').addEventListener('click',()=>{setupPanel.close();$('#cloud-account').click();});
 $('#profile-select').addEventListener('change',async e=>{if(saving){toast('Please wait for the save to finish.');e.target.value=profile.id;return;}try{await loadProfile(e.target.value);}catch(error){status(error.message);}});
 $('#auth-switch').addEventListener('click',()=>{authMode=authMode==='login'?'signup':'login';$('#auth-title').textContent=authMode==='login'?'Welcome back.':'A circle starts with you.';$('#auth-submit').textContent=authMode==='login'?'Sign in':'Create account';$('#auth-switch').textContent=authMode==='login'?'New here? Create an account':'Already have an account? Sign in';$('#auth-form input[name="password"]').autocomplete=authMode==='login'?'current-password':'new-password';$('#auth-error').textContent='';});
 $('#auth-form').addEventListener('submit',async e=>{
  e.preventDefault();const data=Object.fromEntries(new FormData(e.target));$('#auth-error').textContent='';$('#auth-submit').disabled=true;
  try{const result=await request(authMode==='login'?'/auth/v1/token?grant_type=password':'/auth/v1/signup',{method:'POST',authenticated:false,body:{email:data.email.trim(),password:data.password}});e.target.elements.password.value='';if(!result.access_token){$('#auth-error').textContent='Check your email to confirm your account, then return here and sign in.';return;}setSession(result);authPanel.close();await loadAccount();}
  catch(error){$('#auth-error').textContent=error.message;toast(error.message);}
  finally{$('#auth-submit').disabled=false;decorate();}
 });
 $('#profile-form').addEventListener('submit',async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.target));if(!data.name.trim()||!data.member.trim())return;const button=e.target.querySelector('button');button.disabled=true;try{const id=await rpc('create_care_profile',{profile_name:data.name.trim(),profile_age:Number(data.age),member_name:data.member.trim()});setupPanel.close();await loadAccount();$('#profile-select').value=id;}catch(error){$('#profile-error').textContent=error.message;}finally{button.disabled=false;}});
 document.addEventListener('click',e=>{
  if(!configured)return;const b=e.target.closest('button');if(!b)return;
  if(['invite-side','circle-link','copy-code'].includes(b.id)||(b.id==='primary-add'&&page==='circle')){e.stopImmediatePropagation();e.preventDefault();toast('Invite-code joining is coming next. No demo code grants access.');return;}
  if(b.closest('#auth-dialog,#profile-dialog,#reminders-dialog')||b.id==='cloud-account'||b.dataset.page||b.dataset.go||b.hasAttribute('data-close'))return;
  const mutates=b.dataset.taken||b.dataset.skip||b.dataset.undo||b.dataset.delete||b.dataset.mood||['check-in','primary-add','reset-demo','new-appointment'].includes(b.id)||b.dataset.edit||(b.dataset.appointment&&page==='appointments');
  if(mutates&&(!ready||failed||(!members.some(m=>m.user_id===session?.user?.id&&['owner','editor'].includes(m.role))))){e.stopImmediatePropagation();e.preventDefault();toast(!session?'Sign in to manage your care profile.':failed?'Your last save failed. Reload to recover the saved care plan.':'This care profile is read-only.');if(!session)authPanel.showModal();}
 },true);
 document.addEventListener('change',e=>{if(configured&&e.target.matches('#overdue-toggle,#escalation-toggle')&&(!ready||failed||!members.some(m=>m.user_id===session?.user?.id&&['owner','editor'].includes(m.role)))){e.stopImmediatePropagation();e.target.checked=!e.target.checked;toast('You need edit access to change preferences.');}},true);
 window.addEventListener('beforeunload',e=>{if(saving||queued||failed){e.preventDefault();e.returnValue='';}});
 if(configured){
  state=emptyState();render();status('Sign in to sync');
  try{session=JSON.parse(sessionStorage.getItem('kindred-session'));}catch{session=null;}
  if(session)loadAccount().catch(error=>{ready=false;status('Connection failed — sign out or reload');toast(error.message);decorate();});else authPanel.showModal();
 }else{$('#cloud-account').textContent='Connect Supabase';status('Demo mode');}
})();
