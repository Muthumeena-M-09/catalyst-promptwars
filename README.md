# Kindred

A responsive elderly care app with visual pill badges and Supabase account storage. No npm dependencies required. Requires Node 22.16+.

## Chosen vertical

**Elderly Care & Medication Management** within healthcare and assisted living.

Kindred helps older adults organize daily medications and doctor appointments while giving family members and caretakers a shared foundation for coordinating support. The goal is to support independence: the older adult remains central to decisions about their care.

## Approach and logic

The solution brings daily care into one dashboard rather than splitting it across medication lists, calendars, and family messages. The MVP focuses on a clear daily routine, recognizable pill cues, and explicit check-ins.

- **Visual recognition:** Each medication has a selectable color, shape, and size. A CSS pill badge appears beside its name, and the medication form previews the selection. This helps people who recognize a familiar appearance more easily than a pharmaceutical name.
- **Daily organization:** Medication times are grouped into morning (before noon), afternoon (noon to before 5 PM), and evening (5 PM onward). The dashboard calculates progress from doses marked as taken.
- **Explicit adherence records:** Taken and skipped actions are recorded separately for each medication and local calendar date. Undo allows an accidental check-in to be corrected. A skipped dose does not count as taken.
- **Gentle escalation:** When enabled, a dose becomes unconfirmed more than 30 minutes after its scheduled time. The dashboard offers a family check-in acknowledgement. An unconfirmed dose does not prove that the medication was missed; someone may simply have forgotten to record it.
- **Collaborative context:** Appointments, questions for the doctor, mood check-ins, and an activity feed provide context around the medication routine.
- **Controlled access:** Supabase authentication identifies users. Database rules restrict profile reads to owners and authorized members, with writes limited to owners and editors. Member invitation and joining flows are future work.
- **Reliable writes:** Saves run as a database transaction and check a profile revision number. Conflicting changes are rejected instead of silently overwriting another device's update.

## How the solution works

1. **Open the app.** Without a configured Supabase key, it runs as a local demo using synthetic records stored in the browser.
2. **Sign in when connected.** With Supabase configured, users can create an account, confirm their email when required, and sign in. A new account creates an empty care profile with the person's name and age. Demo records are not uploaded.
3. **Build a medication routine.** Add the medication name, prescribed dose, daily time, instructions, and visual pill characteristics. Edit or remove entries as needed.
4. **Record daily care.** Mark doses taken or skipped, check daily progress, and acknowledge unconfirmed-dose check-ins. Mood selections and care actions appear in the activity feed.
5. **Manage visits.** Add doctor appointments with a date, time, location, and questions to discuss. The dashboard highlights the next upcoming visit.
6. **Save and revisit.** In connected mode, changes are saved to Supabase. Signing in to the same account on another device loads the saved care profile. Reload to retrieve updates made elsewhere; live subscriptions are not yet implemented.

### Technical structure

| Component | Responsibility |
| --- | --- |
| `index.html`, `styles.css`, `cloud.css` | Responsive dashboard, forms, pill badges, and account controls |
| `app.js` | Medication scheduling, check-ins, appointments, mood tracking, and local demo state |
| `cloud.js` | Supabase authentication, token refresh, profile loading, and queued cloud saves |
| `server.js` | Local Node.js server and an endpoint exposing only public Supabase configuration |
| `supabase/schema.sql` | PostgreSQL tables, Row Level Security, membership checks, and transactional functions |
| `tests/cloud.test.js` | Mocked integration checks for authentication, storage behavior, and conflicts |

The database separates **profiles**, **medications**, **dose logs**, **appointments**, and **care-circle members**. Supporting activity, mood, reminder preferences, and check-in acknowledgements are stored in the profile's JSON metadata. The browser communicates through Supabase Auth and its database API using a public project key and the signed-in user's access token.

## Assumptions made

- The initial scope is a time-limited MVP, so completing the core medication and appointment flow takes priority over advanced integrations.
- Medication names, doses, times, and instructions are entered from an existing prescription or care plan. The application does not prescribe, identify unknown pills, or recommend what to do after a missed dose.
- Each medication has one recurring daily time in the current implementation. Multiple daily doses can be represented as separate schedule entries; complex recurrence rules are not implemented.
- Daily check-ins and unconfirmed-dose calculations use the device's local date and time. Dedicated profile time zones and travel handling are future work.
- Pill color, shape, and size are user-selected memory aids, not verified identifiers. Manufacturer changes may alter a pill's appearance.
- Adherence is self-reported. A taken check-in records the user's action; it does not independently confirm ingestion.
- The account creating a profile receives owner access. The prototype does not verify legal caretaking authority or implement a consent-management workflow.
- A configured Supabase project, email/password authentication, and the supplied SQL schema are prerequisites for connected mode. Internet access is required for cloud operations; offline cloud editing is not supported.
- Care-circle membership is represented and enforced in the database, but self-service invitations, passcode joining, and member administration are not implemented. The demo invite code does not authorize access.
- Reminders currently appear while the page is open. Email delivery, unattended background reminders, and appointment notification jobs remain planned features.
- Synthetic data is appropriate for the prototype. Production use requires additional deployment, privacy, security, and access-control verification.

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
