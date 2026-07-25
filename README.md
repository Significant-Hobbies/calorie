# Calorie

Calorie is a cute, mobile-first food, water, and weight journal. It tracks
calories, carbs, protein, and fibre, then gives deterministic sleep, gym-timing,
fasting-window, and goal guidance without using AI.

The app is local-first: **Start on this device** works without an account and
keeps the journal in versioned browser storage. Google sign-in is optional and
enables private Cloudflare D1 sync when the cloud bindings are configured.

Production target: `https://calorie.significanthobbies.com`

## Local development

Requirements: Node.js 22+ and pnpm.

```bash
pnpm install
pnpm dev
```

Open the printed Vite URL, choose **Start on this device**, and complete the
four-step onboarding flow. No credentials or local database are required for
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

The Worker uses Better Auth with Google and a D1 database. Before a production
deployment, create the D1 database, place its real database ID in
`wrangler.jsonc`, and configure these Worker secrets outside the repository:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `BETTER_AUTH_SECRET`

Apply `migrations/0001_initial.sql` to the target database only as an explicit
deployment step. The repository intentionally contains no credentials and has
not been deployed.

## How recommendations work

The formulas live in `src/lib/recommendations.ts` and are covered by unit tests.
They use the Mifflin–St Jeor resting-energy equation, an activity multiplier,
bounded goal adjustments, fibre scaled to energy intake, logged eating gaps,
and simple meal-timing heuristics. Every result is labelled as an estimate in
the UI; Calorie is not medical advice.

## Product boundary

The MVP includes onboarding, reusable foods, one-tap and custom food logging,
water, weight, 7/30-day history, offline support, and an installable PWA. A
lightweight workout event—type, planned/actual time, duration, and note—is
deferred. Exercise programming, sets/reps, progressive overload, and wearable
sync are intentionally outside this product’s current scope.
