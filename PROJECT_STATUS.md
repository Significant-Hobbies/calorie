# Calorie — PROJECT STATUS

Last updated: 2026-07-25

## Why / What

Calorie is a private, mobile-first food, water, and weight journal that turns
lightweight macro tracking into practical daily timing guidance. It works
account-free with local browser storage; optional Google sign-in can add private
Cloudflare D1 sync.

In scope: timestamped food entries, reusable foods measured per 100 g or per
unit, calories/carbs/protein/fibre, water, weight, daily totals, eating-gap
history, and transparent sleep/gym/goal estimates.

Out of scope: medical diagnosis, clinical nutrition advice, weight-loss
prescriptions, barcode scanning, social feeds, paid plans, wearable sync, and a
full sets/reps workout-programming system.

## Dependencies

### External

- React and Vite
- Optional Google OAuth through Better Auth
- Cloudflare Workers, static assets, and D1 for optional cloud sync

### Internal

- Fleet deployment, accessibility, and UI standards

## Timeline

- 2026-07-25 — local project scaffold, specification, implementation, and
  browser validation completed

## Products

- Installable local-first web app
- Planned production Worker at `https://calorie.significanthobbies.com`

## Features (shipped)

- Four-step goal-aware onboarding with editable health assumptions
- Fully account-free local journal with versioned browser storage
- Optional Google sign-in and per-user D1 API implementation
- Reusable foods per unit or per 100 g
- One-tap and custom amount/time food logging with edit, delete, and undo
- Calories, carbs, protein, fibre, water, and weight tracking
- Transparent energy, macro, fasting-window, gym-time, and sleep-time estimates
- Seven- and thirty-day progress views with non-colour chart cues
- Installable PWA shell, recent cloud-state cache, and queued offline writes
- Responsive mobile, tablet, and desktop UI with accessible touch targets

## Todo / Planned / Deferred / Blocked

### Planned before production

1. Create the production D1 database and configure its binding ID.
2. Configure Google OAuth and Better Auth secrets outside the repository.
3. Apply the production migration and deploy only with explicit approval.
4. Run a final smoke test on `calorie.significanthobbies.com`.

### Deferred

- Lightweight workout events: type, planned/actual time, duration, and note.
- Export/import or account-based transfer of an existing local journal.
- Barcode scanning, wearable sync, deeper trends, and richer reminders.

### Blocked

- Production cloud setup is intentionally blocked on credentials, D1 creation,
  and explicit deployment approval.
