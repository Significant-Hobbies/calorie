# Calorie

Calorie is a cute, mobile-first food, water, medication-routine, and weight
journal. It tracks calories, carbs, protein, and fibre, then gives deterministic
sleep, exercise-timing, fasting-window, and goal guidance without using AI.

The app is local-first: **Start on this device** works without an account and
keeps the journal in versioned browser or iPhone storage. Google sign-in is
optional on the web. The native client can explicitly link Sign in with Apple
to an existing Google-backed journal and enable private Cloudflare D1 sync when
the cloud bindings are configured.

Production target: `https://calorie.significanthobbies.com`

## Local development

Requirements: Node.js 22+ and pnpm.

```bash
pnpm install
pnpm dev
```

Open the printed Vite URL, choose **Start on this device**, and complete the
three-step onboarding flow. No credentials or local database are required for
the account-free experience.

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
- `APPLE_CLIENT_ID`
- `APPLE_CLIENT_SECRET`
- `APPLE_APP_BUNDLE_IDENTIFIER`

Apply the numbered D1 migrations to the target database only as an explicit
deployment step. `0002_personalized_daily_care.sql` adds private medication
routines/check-offs and manual calorie-range columns. The repository
intentionally contains no credentials.

Production uses a dedicated Google web client with
`https://calorie.significanthobbies.com` as its JavaScript origin and
`https://calorie.significanthobbies.com/api/auth/callback/google` as its
callback. Only the standard OpenID Connect identity scopes are requested.
Native Apple credentials are verified for `com.significanthobbies.calorie`.
Implicit email linking is disabled; existing owners authenticate their Google
account first, then link the verified Apple provider identity explicitly.

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

Calorie v1 includes onboarding, reusable foods, one-tap and custom food logging,
water beyond the target, private daily medication check-offs, weight, 7/30-day
history, light/dark themes, offline support, and an installable PWA. Production
includes the numbered D1 migrations for medication and profile-range data. Workout
programming, sets/reps, progressive overload, and wearable sync are separate
product ideas rather than unfinished Calorie features.
