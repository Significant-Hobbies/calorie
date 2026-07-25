## Why

Food logging only becomes useful when it is fast enough to sustain. Calorie
needs a private, installable mobile experience that turns one-tap nutrition,
water, and weight history into transparent goal and timing estimates without
an AI dependency.

## What Changes

- Add no-account local mode, optional Google authentication, and a short onboarding flow for identity,
  measurement units, body inputs, activity, weight goal, pace, and sleep
  routine.
- Add reusable foods measured per 100 g or per unit, recent/favourite
  shortcuts, timestamped entries, and one-tap water presets.
- Track weight check-ins and calculate daily energy, protein, and fibre targets
  from published formulas and user-controlled assumptions.
- Calculate completed fasting windows plus gym and sleep timing estimates from
  logged events.
- Add historical weekly statistics for nutrition, water, fasting, and weight.
- Make the React app installable as a PWA with an offline app shell, cached
  recent data, and a retry queue for offline writes.
- Store local-mode data in browser storage and cloud-account data in Cloudflare
  D1 with strict per-user isolation.

## Capabilities

### New Capabilities

- `private-account-setup`: No-account local mode, optional Google sign-in,
  onboarding, editable profile inputs, and goal configuration.
- `daily-intake-log`: Reusable foods, one-tap food and water logging, daily
  totals, and entry editing/deletion.
- `transparent-guidance`: Formula-based nutrition targets, fasting counts, and
  gym/sleep timing estimates with visible explanations.
- `progress-history`: Weight check-ins and historical nutrition, hydration,
  fasting, and weight statistics.
- `installable-offline-app`: PWA installability, cached recent state, and
  durable retry of offline writes.

### Modified Capabilities

None.

## Impact

- New Vite/React client, Cloudflare Worker API, D1 schema/migration, and PWA
  assets.
- Runtime dependencies are limited to React, Better Auth, Drizzle ORM, Hono,
  Lucide icons, and `idb`; build/test tooling uses Vite, TypeScript, Wrangler,
  Biome, and Vitest.
- Optional cloud mode will later require a D1 database plus Google OAuth and
  Better Auth secrets. This change does not create or deploy those resources.
