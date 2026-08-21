# Calorie — PROJECT STATUS

Last updated: 2026-08-21

## Why / What

Calorie is a private, native food, water, and weight journal that turns
lightweight macro tracking into practical daily timing guidance. It works
account-free with local iPhone or iPad storage; optional native Apple sign-in
can add private Cloudflare D1 sync.

In scope: timestamped food entries, reusable foods measured per 100 g or per
unit, calories/carbs/protein/fibre, water, medication routines and daily
check-offs, weight, daily totals, eating-gap history, and transparent
sleep/exercise/goal estimates.

Out of scope: medical diagnosis, clinical nutrition advice, weight-loss
prescriptions, barcode scanning, social feeds, paid plans, wearable sync, and a
full sets/reps workout-programming system.

## Dependencies

### External

- Better Auth for native Apple identity and retained authenticated service
  access
- SwiftUI, AuthenticationServices, and Keychain for the native iOS client
- Cloudflare Workers, static assets, and D1 for optional cloud sync

### Internal

- Fleet deployment, accessibility, and UI standards

## Timeline

- 2026-08-21 — applied additive D1 migration
  `0008_shared_family_identity.sql`, deployed exact SHA
  `040474d9f41c6e5884beb0761d13d275d1e8e70a` at 100% Worker traffic, and
  prepared Apple Distribution-signed native build `1.0.0 (4)`; uploading the
  package waits for the personal account to be added to Xcode 27 Beta 5
- 2026-08-21 — retired the browser journal and its React/Vite/PWA code, leaving
  the native iPhone/iPad product, static landing and legal pages, authenticated
  semantic APIs, D1 data, and Cloudflare synchronization intact; old `/app`
  bookmarks now redirect permanently to the product page
- 2026-08-21 — expanded the native Apple identity verifier to accept the Kith
  bundle alongside Calorie and deployed the exact merged SHA at 100% Worker
  traffic; exact native callback allowlisting remains enforced
- 2026-08-17 — public `/` became the shared landing snapshot and the browser
  journal moved to `/app/`; this arrangement was superseded by the native-only
  release on 21 August.
- 2026-08-16 — Apple confirmed native build `1.0.0 (3)` is available to
  internal TestFlight testers under personal Apple team `8F7LXHTJZR` and app
  ID `6801238805`; this is not a public App Store release
- 2026-08-12 — adopted the Fleet code-health contract as the single CI gate:
  whole-source web and native coverage, unused code, cross-language complexity,
  exact duplication, import/target cycles, severe advisories, suppression
  markers, web/native builds, and repository hygiene now have explicit
  non-regression floors or ceilings; removed unused exports and duplicate
  aliases, and targeted tool updates reduced high advisories from two to zero
- 2026-08-11 — released native Sign in with Apple, explicit linking to an
  existing Google-owned journal, deterministic iPhone/cloud reconciliation,
  durable offline sync intents, and single-use Google-to-native handoffs; D1
  migration `0007` is applied in production and the Worker is SHA-tagged at
  100% traffic
- 2026-08-11 — prepared the first universal native SwiftUI iPhone and iPad beta
  with complete local-first food and daily-care logging, transparent guidance, progress,
  data transfer, accessibility, simulator coverage, App Store metadata, and a
  personal-team signed archive with a verified Sign in with Apple entitlement
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

- Universal native SwiftUI iPhone and iPad beta under `ios/`; build `1.0.0 (3)`
  is available to internal TestFlight testers on the personal Apple team
- Static native-product landing and legal/support pages
- Production Worker — `https://calorie.significanthobbies.com`

## Features (shipped)

- Public `/` native-product landing snapshot from ios-landings; retired `/app`
  routes redirect permanently to `/`
- CI-enforced mixed web/native Fleet code-health ratchets across whole-source
  coverage, dead code, complexity, duplication, cycles, dependency advisories,
  suppression markers, builds, and repository hygiene
- Native iPhone and iPad journal with local onboarding, food/water/weight/routine
  capture, transparent calculations and guidance, progress/history, food
  management, data transfer, appearance and accessibility support, simulator
  tests, and personal-team archiving
- Native Sign in with Apple using bundle-audience token verification, explicit
  existing-account linking without email matching, Keychain bearer sessions,
  iPhone/cloud reconciliation, and durable offline sync intents
- Shared native Apple audience verification for Calorie and Kith with exact
  callback allowlisting
- Shared Ultracite lint baseline for the retained TypeScript service
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
- Native system appearance and accessibility support

## Work queue

Open work is tracked only in [GitHub Issues](https://github.com/Significant-Hobbies/calorie/issues).
An open issue is a to-do, a linked pull request is in progress, and merge plus
issue closure makes the work done.
