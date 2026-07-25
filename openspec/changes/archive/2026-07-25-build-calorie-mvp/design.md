## Context

Calorie starts as a local-first Vite/React product with one optional
Cloudflare Worker and one D1 database for cloud accounts. It must feel native
on a phone, work fully without authentication or connectivity, keep every
journal private, and explain health-related estimates without presenting them
as medical advice.

The visual contract lives in `PRODUCT.md`, `DESIGN.md`, and
`docs/design/calorie-mobile-north-star.png`.

## Goals / Non-Goals

**Goals:**

- Make a familiar food or water amount loggable in one tap.
- Keep saved foods flexible enough for per-100-g and per-unit nutrition.
- Store raw events so daily and historical views derive from one source of
  truth.
- Keep recommendation math pure, documented, and unit-tested.
- Support no-account browser storage, optional Google auth, offline-safe cloud
  writes, and eventual production deployment on one Cloudflare Worker with D1.

**Non-Goals:**

- Medical diagnosis, meal plans, supplement advice, or clinical calorie floors.
- Barcode/photo recognition, AI recommendations, social features, or wearable
  integrations.
- Background location, notification reminders, or native app wrappers.

## Decisions

### One Worker serves the SPA and API

Vite builds the React client into `dist`; a Hono Worker handles `/api/*` and
Better Auth routes, while the Workers static-assets binding serves the
installable SPA. `wrangler.jsonc` selectively runs the Worker first for API
routes and uses SPA fallback elsewhere.

This keeps one Cloudflare surface and one origin for cookies. Separate Pages
and API deployments were rejected because they add CORS, cookie, and release
coordination without helping this small product.

### Better Auth owns Google sessions in D1

Better Auth uses its Drizzle D1 adapter for user, session, account, and
verification tables. Every product query first resolves the session and
includes `user_id` in its WHERE clause. Product IDs use `crypto.randomUUID()`.

Home-grown OAuth was rejected because session rotation, provider callbacks,
and cookie security are not product differentiators.

### Local mode is a complete product path

The sign-in screen leads with Start on this device. A versioned local state
stores the profile, saved foods, food entries, water, and weights in browser
storage. The same domain functions and screens serve local and cloud modes;
only their persistence adapters differ. Local mode is not a demo and does not
require a network request after the PWA shell is installed.

### Event-oriented relational model

D1 stores:

- `profiles`: onboarding inputs, unit preference, energy-equation profile,
  goal, target weight, wake time, sleep need, and fasting threshold.
- `foods`: private reusable definitions with `per_100g` or `per_unit` basis.
- `food_entries`: nutrition/name snapshots plus timestamp and source food id,
  so history survives food-definition edits while individual entries remain
  correctable.
- `water_entries`: timestamped millilitres.
- `weight_entries`: timestamped kilograms.

All timestamps are UTC milliseconds; the client supplies its IANA timezone for
day boundaries and displays. The initial database migration includes
user/time indexes for each event table.

### Recommendations are pure deterministic functions

- Resting energy uses Mifflin–St Jeor, then a user-selected activity factor.
  The UI calls this an estimate and shows all inputs.
- Goal adjustment uses a conservative user-selected daily adjustment rather
  than promising a weight-loss date.
- Protein shows the current U.S. Dietary Guidelines range of 1.2–1.6 g/kg/day.
- Fibre target uses 14 g per 1,000 kcal.
- A completed fast is a gap between caloric food entries at or above the
  user's threshold (default 12 hours). Water never ends a fast.
- Sleep timing is the later of the user's wake-time-derived bedtime and the
  last food's settling window: one hour for a small snack, two for a normal
  entry, three for a heavy entry.
- Gym timing is a broad post-entry window based on the most recent carbohydrate
  amount, bounded by the sports-nutrition guidance that pre-exercise
  carbohydrate is commonly consumed in the one-to-four hours before exercise.

Each result includes a short explanation and never claims medical precision.
Relevant source links are included in the app's methodology disclosure.

### One-tap logging uses defaults plus undo

The Today screen shows favourite/recent foods with their default serving and
water presets (250, 350, and 500 ml). A tap optimistically adds the entry and
offers Undo; long-press or an adjacent edit affordance opens amount/time
controls. The full food sheet remains available for search and new foods.

Confirmation dialogs were rejected because they defeat the adherence goal.

### Offline writes use IndexedDB

The service worker caches the versioned app shell. The `idb` helper stores the
latest successful dashboard response and a queue of idempotent write commands.
Queued commands carry client-generated IDs, render optimistically, and retry on
startup and `online`. D1 primary keys make retries safe.

The app never caches OAuth responses. Cached cloud dashboard data is cleared on
sign-out. Local mode instead keeps its complete versioned journal in browser
storage by explicit user choice.

### Historical statistics derive from raw events

The API returns bounded daily aggregates for a requested 7- or 30-day range.
The client renders native SVG/CSS trend visuals for calories, macros, water,
fasting, and weight, avoiding a chart runtime dependency.

## Risks / Trade-offs

- **Predictive energy equations can be wrong for an individual** → show an
  estimate range, inputs, methodology, and editable manual daily target.
- **Sex-based published equations are not inclusive** → ask which equation
  profile to use separately from optional gender identity and allow users to
  skip the energy estimate.
- **Local private data remains on the device** → state this before local-mode
  entry and avoid recommending it on a shared browser.
- **Service-worker caches can become stale** → version caches from the build,
  activate immediately, and keep API/auth routes network-only.
- **One-tap defaults can log the wrong amount** → show amount in the shortcut,
  provide immediate undo, and keep edit accessible.
- **No production database or OAuth credentials exist yet** → local/demo
  validation does not claim production auth readiness.

## Migration Plan

1. Apply the initial D1 migration locally and validate API tests.
2. Create the production D1 database and apply the same migration only after
   deploy approval.
3. Configure Better Auth and Google OAuth secrets through Wrangler's secret
   flow; never commit values.
4. Dry-run the Worker bundle, verify installability, then manually deploy and
   attach `calorie.significanthobbies.com`.
5. Roll back code through a prior Worker version; D1's first migration is
   additive and requires no destructive rollback.

## Open Questions

- Production Google OAuth client and D1 IDs remain intentionally unconfigured.
- Notification reminders, barcode scanning, and health-provider review remain
  later decisions.
