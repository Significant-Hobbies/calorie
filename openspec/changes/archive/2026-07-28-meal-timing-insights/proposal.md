## Why

Calorie already records each food, its nutrients, and its exact eating time, but
Progress currently reduces that detail to daily totals. Turning the existing
entry history into transparent timing patterns makes the journal more useful
without asking the user to track anything new.

## What Changes

- Add deterministic 7-day and 30-day meal-timing analysis to Progress.
- Show the typical first and last food times, average eating-window length,
  time-of-day calorie distribution, repeated foods with their usual logged
  time, and transparent proximity to the saved sleep routine.
- Explain the sample behind every insight and exclude unlogged days instead of
  treating them as zero intake.
- Return bounded food-entry detail with trend history in cloud, local, and demo
  modes.
- Provide a helpful sparse-data state when fewer than two days are logged.
- Keep observations neutral and avoid causal, medical, or weight-loss claims.

## Capabilities

### New Capabilities

- `meal-timing-insights`: Defines transparent timing and food-pattern analysis
  derived from timestamped food entries.

### Modified Capabilities

- `progress-history`: Trend history supplies the bounded entry detail needed for
  timing analysis consistently across cloud, local, and demo journals.

## Impact

- Shared food-timing analysis helper and unit tests.
- History response types plus Worker, local-store, and demo history adapters.
- Progress trends interface and responsive styling.
- No new dependency, database migration, production configuration, or stored
  user data.
