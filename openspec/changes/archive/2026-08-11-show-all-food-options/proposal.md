## Why

Signed-in users with more than 20 active saved foods cannot select foods outside
the dashboard's fixed result cap. The selector should expose the user's complete
active food library so logging remains reliable as the library grows. Backdated
entries also briefly appear in Today's optimistic state, which makes the current
day list and totals temporarily inaccurate.

## What Changes

- Return every active saved food owned by the signed-in user in dashboard data.
- Preserve recent-use and alphabetical ordering in the food selector.
- Add regression coverage proving that dashboard food retrieval has no fixed
  20-item cap.
- Keep optimistic food-entry updates scoped to the dashboard's displayed date,
  including when logging or editing an entry for yesterday.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `daily-intake-log`: Require the reusable-food selector to make every active
  food owned by the current user available.

## Impact

- Cloudflare Worker dashboard query in `src/worker.ts`.
- Today entry state in `src/pages/TodayPage.tsx` and focused regression tests.
- No API shape, dependency, configuration, or database schema changes.
