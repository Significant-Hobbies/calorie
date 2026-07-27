# Calorie — PROJECT STATUS

Last updated: 2026-07-27

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

- 2026-07-27 — added direct one-off food entries and released the editing flow
- 2026-07-25 — finished v1 implemented, validated, and released to Cloudflare

## Products

- Installable local-first web app
- Production Worker — `https://calorie.significanthobbies.com`

## Features (shipped)

- Three-step answer-aware onboarding with reload-safe drafts and visible goal math
- Fully account-free local journal with versioned browser storage
- Working optional Google sign-in with a dedicated production OAuth client and per-user D1 sync
- Public privacy and terms pages for cloud-account users
- Reusable foods per unit or per 100 g
- Direct one-off entries that do not create reusable foods
- One-tap and custom amount/time food logging with edit, delete, and undo
- Calories, carbs, protein, fibre, water, and weight tracking
- Transparent energy, macro, fasting-window, gym-time, and sleep-time estimates
- Seven- and thirty-day progress views with non-colour chart cues
- Navigable month calendar with daily nutrition, water, fasting, and weight details
- Installable PWA shell, recent cloud-state cache, and queued offline writes
- Responsive mobile, tablet, and desktop UI with accessible touch targets

## Todo / Planned / Deferred / Blocked

### Planned

1. Add export/import only if moving a local journal between devices becomes
   important.

### Deferred

- Barcode scanning, wearable sync, deeper trends, and richer reminders.

### Blocked

- None
