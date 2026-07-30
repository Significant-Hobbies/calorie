## Why

Calorie logs food and shows daily totals, but it never tells the user *what to
eat next* to close the remaining calorie/protein/fibre gap on a given day. The
owner also does not use the "favourite / show in Today's quick picks" pin on
saved foods, and wants food-level analytics (most-consumed foods and related
patterns) that the app currently lacks. The history endpoint already returns
individual entries, so food analytics can be computed without new backend
work.

## What Changes

- Add an always-on "Remaining today" panel on Today that shows leftover
  calories, protein, and fibre against the day's target and suggests the saved
  foods that best fill the largest remaining macro gap.
- Remove the favourite concept from the saved-food experience: drop the
  "Show in Today's quick picks" toggle from the food editor, drop the star
  icon and favourite-based sort on the Foods list, and order Today's quick
  picks by last-used instead. The underlying `favourite` column/field stays in
  storage for backward compatibility but is no longer set or read by the UI.
- Add a new "Insights" tab (5th primary tab) with food-level analytics over a
  7- or 30-day window: most-logged foods by entry count, biggest calorie
  contributors, average per-occasion macros for top foods, and total logged
  occasions. Sourced from the existing history entries payload.
- Add an inferred daily rating (1–5) on Today and in calendar day detail,
  computed purely from the percentage of calorie, protein, fibre, and water
  targets met. No new table, route, or user input — the rating reflects
  completion, not a manual score.

## Capabilities

### New Capabilities

- `food-analytics`: A dedicated Insights surface computing food-level
  consumption patterns from history entries over a selectable window.

### Modified Capabilities

- `daily-intake-log`: Replace favourite-based quick picks with last-used
  ordering, add a remaining-macro completion suggestion panel on Today, and
  show an inferred daily rating from target completion.

## Impact

- `TodayPage` (new remaining-macro panel, quick-pick ordering), `FoodsPage`
  (remove favourite toggle and star), `AppShell` + `App` (new Insights tab),
  new `InsightsPage`, new `lib/food-analytics.ts` helper, and a
  `lib/macro-completion.ts` helper.
- No schema migration, no new Worker routes, no new dependency, no deploy, and
  no change to cross-user isolation. Analytics reuse the existing
  `/api/app/history` entries payload and the local/demo history paths.
- Updates to the `daily-intake-log` durable spec and a new `food-analytics`
  spec, plus a `PROJECT_STATUS.md` entry on ship.
