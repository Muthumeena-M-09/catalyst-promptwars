# Kindred

A responsive elderly care app with visual pill badges and Supabase account storage. No npm dependencies required. Requires Node 22.16+.

## Connect Supabase

1. Copy `.env.example` to `.env` in this project folder:

   ```powershell
   Copy-Item .env.example .env
   ```

2. Open `.env` and replace the key placeholder:

   ```dotenv
   SUPABASE_URL=https://fjkydwoilewkgueznotx.supabase.co
   SUPABASE_PUBLISHABLE_KEY=your_publishable_key_here
   ```

   Get the publishable key from your Supabase project's API Keys settings. Legacy `anon` keys also work. Do not enter a database password, secret key, service-role key, or PostgreSQL connection string. `.env` is ignored by Git. `/config.js` exposes only these two public settings; the HTTP server never serves `.env`.

3. In Supabase **SQL Editor**, paste and run `supabase/schema.sql` **once** in a new project. It creates profiles, medications, dose logs, appointments, care-circle membership, access policies, and transactional save/load functions. This is an initial schema, not a repeatable migration. Do not rerun over existing tables.

4. Enable email/password sign-in in Supabase Authentication. Set the Auth Site URL and allowed redirect URL to `http://127.0.0.1:3000`. After confirming your email, return to the app and sign in. Use your HTTPS domain when deploying.

5. Start or restart the server after editing `.env`. Create an account, confirm your email if required, sign in, and create a care profile. New profiles start empty; demo medications are never uploaded. Add a medication, mark it taken, reload, and verify the record. Sign in from another browser to the same account to verify cross-device persistence.

## Run

```sh
npm run dev
```

Open http://127.0.0.1:3000. Run `npm run check` for JavaScript syntax validation and `npm test` for mocked integration tests.

## Included

- Daily medication dashboard with morning, afternoon, and evening groups
- Medication creation, editing, removal, and CSS pill badges (color, shape, size)
- Taken / skipped / undo check-ins, saved by local calendar date
- Appointment creation, notes, and removal
- Mood check-ins, activity feed, and demo care circle
- Configurable unconfirmed-dose prompts and a family check-in acknowledgement
- Supabase sign-up, sign-in, sign-out, and access-token refresh
- Account profiles and transactional database persistence
- Local demo mode when no Supabase key is configured
- Responsive layouts and accessible form labels

## Prototype boundaries

Account tokens live in this tab's sessionStorage. Cloud records stay in memory and Supabase, separate from demo localStorage. Signing out clears the loaded profile. Owners and authorized members can read a care profile; owners and editor members can save; viewers cannot write. New profiles receive owner membership automatically. Member invitations and administration are not implemented: the demo invite code grants no access.

Saves are transactional and use a revision check. Conflicting changes from another device are rejected. A failed save displays an error and blocks more edits; reload to recover the last saved version. Wait for “Saved to Supabase” before leaving. Other devices see updates on reload; live subscriptions are not implemented.

Tests mock Supabase HTTP responses. They do not execute PostgreSQL policies. Real authentication, email confirmation, and database access isolation must be checked after configuring your project. Email reminders, password recovery, and background scheduling are not implemented. Use synthetic records until deployment and privacy controls are reviewed. Pill appearance is a memory aid; verify labels and follow prescribed instructions.
