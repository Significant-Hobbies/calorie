# Calorie

Calorie is a cute, mobile-first food, water, medication-routine, and weight
journal. It tracks calories, carbs, protein, and fibre, then gives deterministic
sleep, exercise-timing, fasting-window, and goal guidance without using AI.

The native app is local-first: it works without an account and keeps the
journal on the iPhone or iPad. Optional Sign in with Apple adds private
Cloudflare D1 synchronization.

Production target: `https://calorie.significanthobbies.com`

## Local development

Requirements: Node.js 22+ and pnpm.

```bash
pnpm install
pnpm dev
```

`pnpm dev` builds and serves the static native-product landing together with
the authenticated Worker APIs. The SwiftUI app lives under `ios/` and remains
usable without the Worker.

Useful checks:

```bash
pnpm check
pnpm test
pnpm build
pnpm db:migrate:local
pnpm types:worker
pnpm exec wrangler deploy --dry-run
```

## Cloud mode

The Worker uses Better Auth with Google, optional Apple ID-token verification,
bearer sessions for the native client, and a D1 database. Before a production
deployment, create the D1 database, place its real database ID in
`wrangler.jsonc`, and configure these Worker secrets outside the repository:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `BETTER_AUTH_SECRET`

Native Sign in with Apple verifies the Apple ID token against Apple's public
keys and the tracked `APPLE_APP_BUNDLE_IDENTIFIER`. Browser-based Apple OAuth
is not required by the iPhone client; enabling it later additionally requires
`APPLE_CLIENT_ID` and `APPLE_CLIENT_SECRET` Worker secrets.

Apply the numbered D1 migrations to the target database only as an explicit
deployment step. `0002_personalized_daily_care.sql` adds private medication
routines/check-offs and manual calorie-range columns. The repository
intentionally contains no credentials.

The public site is the shared native-product landing at `/`; there is no web
journal. The retained Google callback stays at
`https://calorie.significanthobbies.com/api/auth/callback/google` as its
callback. Only the standard OpenID Connect identity scopes are requested.
Native Apple ID tokens are verified for `com.significanthobbies.calorie`.
Implicit email linking is disabled; existing owners authenticate their Google
account to sync directly, then may explicitly link the verified Apple provider
identity without changing journals.

## How recommendations work

The formulas live in `src/lib/recommendations.ts` and are covered by unit tests.
They use the Mifflin–St Jeor resting-energy equation, an activity multiplier,
maintenance-relative goal ranges (75–85% for loss, 95–105% for maintenance,
and 105–110% for gradual gain), a 1,200 kcal automatic floor, protein ranges,
fibre scaled to energy intake, logged eating gaps, and simple meal-timing
heuristics. Onboarding, Today, and Settings show how the selected answers
change the result. Every result is labelled as an estimate in the UI; Calorie
is not medical advice.

## Current source scope

Calorie v1 includes native onboarding, reusable foods, one-tap and custom food
logging, water beyond the target, private daily medication check-offs, weight,
7/30-day history, appearance support, and offline operation. Production
includes the numbered D1 migrations for medication and profile-range data. Workout
programming, sets/reps, progressive overload, and wearable sync are separate
product ideas rather than unfinished Calorie features.
