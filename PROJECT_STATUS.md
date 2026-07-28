# Calorie — PROJECT STATUS

Last updated: 2026-07-28

## Why / What

Calorie is a private, mobile-first food, water, and weight journal that turns
lightweight macro tracking into practical daily timing guidance. It works
account-free with local browser storage; optional Google sign-in can add private
Cloudflare D1 sync.

In scope: timestamped food entries, reusable foods measured per 100 g or per
unit, calories/carbs/protein/fibre, water, medication routines and daily
check-offs, weight, daily totals, eating-gap history, and transparent
sleep/exercise/goal estimates.

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

- 2026-07-28 — released deterministic meal-timing insights from existing food
  timestamps across 7- and 30-day trends
- 2026-07-27 — released maintenance-relative calorie ranges, uncapped water
  logging, private medication routines/check-offs, dark mode, and PWA install
  hardening
- 2026-07-27 — implemented and validated automatic food-derived fasting windows
  plus stronger loss and protein target calibration
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
- Maintenance-relative energy ranges, loss protein ranges, and a 1,200 kcal
  automatic floor
- Water logging beyond the daily target and private medication routines with
  Morning/Evening/Either daily check-offs
- Automatic fasting, next-exercise, and sleep-time estimates
- Seven- and thirty-day progress views with non-colour chart cues
- Timezone-aware eating rhythm, nutrient timing, and repeated-food timing
  analysis with visible samples and assumptions
- Navigable month calendar with daily nutrition, water, fasting, and weight details
- Installable PWA shell, recent cloud-state cache, and queued offline writes
- System, Light, and composed botanical Dark appearance modes
- Responsive mobile, tablet, and desktop UI with accessible touch targets

## Todo / Planned / Deferred / Blocked

### Planned

1. Add export/import only if moving a local journal between devices becomes
   important.

### Deferred

- Barcode scanning, wearable sync, weight/health correlations, and richer
  reminders.

### Blocked

- None
