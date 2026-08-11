# Calorie — PROJECT STATUS

Last updated: 2026-08-11

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

- 2026-08-11 — prepared the first native SwiftUI iPhone beta with complete
  local-first food and daily-care logging, transparent guidance, progress,
  data transfer, accessibility, simulator coverage, App Store metadata, and a
  personal-team signed archive path; native account synchronization remains
  tracked separately
- 2026-08-11 — finalized the food-first mobile Today hierarchy and actionable
  Progress insights with equal 7/30-day comparisons, visible target/sample
  context, accessible progressive chart disclosure, modal focus containment,
  safe 320px reflow, and composed dark-mode contrast
- 2026-08-11 — removed the private-cloud dashboard's 20-food cap so the food
  selector exposes every active food owned by the signed-in user while
  preserving recent-use and alphabetical ordering; backdated food saves and
  cross-date edits now stay out of Today's optimistic list and nutrient totals
- 2026-08-10 — released a desktop-default 24-hour weekly calendar with
  timestamped food, weight, and medicine events, explicit period navigation,
  collision-safe event details, and user-scoped session caching for instant
  revisits; retained the mobile month calendar and extracted calendar styling
  from the global stylesheet
- 2026-08-09 — released binary packaged/not-packaged food classification for
  saved and one-off entries, completion-aware daily logging prompts, and a
  Progress hardening pass covering exact accessible chart data, touch targets,
  local-date corrections, graph spacing, and mobile polish; D1 migration
  `0005` is applied in production
- 2026-08-09 — adopted the Fleet Ultracite baseline for core TypeScript,
  React, and Vitest code; explicit compatibility exceptions preserve current
  behavior while 87 files pass with zero diagnostics
- 2026-08-09 — released cycle sessions/analytics, owner-ordered daily prompts,
  water/weight corrections, JSON backup, food archive/classification,
  simplified food sorting, late-night/rest and non-stale exercise guidance,
  and mobile bottom-navigation tuning; D1 migrations `0003` and `0004` are
  applied in production
- 2026-07-31 — added the full agent brief as a static asset so Cloudflare's
  asset-first routing serves `/llms-full.txt` before the SPA fallback
- 2026-07-31 — prepared and locally verified public agent discovery,
  privacy/changelog Markdown, sitemap coverage, and complete homepage
  search/social metadata; production deployment remains separate
- 2026-07-30 — released remaining-macro completion suggestions, an inferred
  daily rating, a dedicated food-analytics Insights tab, and last-used quick
  picks replacing the favourite pin
- 2026-07-29 — added a public, editorial `/changelog` with verified release
  outcomes plus direct repository Roadmap and Source links
- 2026-07-29 — released chronological food-entry details for selected dates in
  calendar history across local, demo, and private cloud journals
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

- Native SwiftUI iPhone beta under `ios/`; App Store Connect/TestFlight
  transport remains manual
- Installable local-first web app
- Production Worker — `https://calorie.significanthobbies.com`

## Features (shipped)

- Native iPhone journal with local onboarding, food/water/weight/routine
  capture, transparent calculations and guidance, progress/history, food
  management, data transfer, appearance and accessibility support, simulator
  tests, and personal-team archiving
- Shared Ultracite lint baseline with a clean 87-file check
- Three-step answer-aware onboarding with reload-safe drafts and visible goal math
- Fully account-free local journal with versioned browser storage
- Working optional Google sign-in with a dedicated production OAuth client and per-user D1 sync
- Public privacy and terms pages for cloud-account users
- Reusable foods per unit or per 100 g
- Complete active saved-food selection without a fixed item-count cap
- Date- and timezone-correct optimistic food logging for Today's list and totals
- Food archiving plus packaged/not-packaged classification on saved foods and
  one-off entries
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
- Navigable month calendar with daily nutrition, water, fasting, weight, and
  chronological food-entry details
- Desktop-default 24-hour weekly calendar with timestamped food, weight, and
  medicine events, type filters, explicit period navigation, and instant
  same-session revisits
- Remaining-macro completion suggestions on Today with one-tap foods that
  best close the day's largest gap
- Four prominent daily logging prompts that disappear as weight, supplements,
  food, and water are completed
- Food analytics in Progress with logged-day confidence, configured-target
  coverage, equal prior-window comparisons, one practical takeaway, and
  retained food rankings over 7- and 30-day windows
- Food-first Today hierarchy with reusable quick picks before lower-frequency
  daily prompts and a keyboard-contained entry sheet
- Last-used quick picks on Today replacing the favourite pin
- Installable PWA shell, recent cloud-state cache, and queued offline writes
- System, Light, and composed botanical Dark appearance modes
- Responsive mobile, tablet, and desktop UI with accessible touch targets

## Work queue

Open work is tracked only in [GitHub Issues](https://github.com/Significant-Hobbies/calorie/issues).
An open issue is a to-do, a linked pull request is in progress, and merge plus
issue closure makes the work done.
