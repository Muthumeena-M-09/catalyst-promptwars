# Kindred

A responsive elderly care prototype, built without dependencies.

## Run

```sh
npm run dev
```

Open http://localhost:3000. Run `npm run check` for JavaScript syntax validation.

## Included

- Daily medication dashboard with morning, afternoon, and evening groups
- Medication creation, editing, removal, and CSS pill badges (color, shape, size)
- Taken / skipped / undo check-ins, saved by local calendar date
- Appointment creation, notes, and removal
- Mood check-ins, activity feed, and demo care circle
- Configurable unconfirmed-dose prompts and a family check-in acknowledgement
- Browser-local persistence and cross-tab updates
- Responsive layouts and accessible form labels

## Prototype boundaries

All records are synthetic examples. Data stays in localStorage on this browser. There is no authentication, real invite-code validation, cross-device sharing, email delivery, or background scheduler. Do not store real patient information in this prototype. For production, add authenticated accounts, server-enforced membership permissions, protected storage, audit records, an email provider, and idempotent scheduled reminder jobs. Pill appearance is only a memory aid and must not be used to identify an unknown pill or provide dosing advice.
