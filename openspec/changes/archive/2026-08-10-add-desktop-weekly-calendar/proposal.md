## Why

The monthly Progress calendar is useful for spotting whether a day has data, but reviewing what was actually eaten still requires selecting one day at a time. A desktop weekly journal should make seven days of food names and eating times visible together so the owner can take nutrition tracking more seriously without turning Calorie into a dense clinical dashboard.

## What Changes

- Add a Week/Month calendar mode control on desktop, with Week selected by default.
- Render the selected Monday-to-Sunday week as seven day columns containing chronological food names and local eating times, plus a compact daily calorie summary.
- Add previous-week and next-week navigation, with future weeks unavailable and the current week's future days presented as inactive.
- Add `All`, `Food`, `Weight`, and `Medicine` filters; All shows a chronological mix of food entries, weight check-ins, and actual medicine check-ins.
- Extend bounded history responses with private medicine check-in events and their medicine names without changing stored medication data.
- Compute a transparent protein-and-fibre-per-calorie nutrient-density rating for saved foods and individual food-entry snapshots; do not persist the rating or use packaging/carbohydrates as negative inputs.
- Keep the existing monthly grid and selected-day detail available on desktop through Month mode.
- Keep the current monthly calendar behavior on smaller screens for now; the weekly journal is desktop-only in this change.
- Reuse and extend the existing bounded calendar-history response; do not add a database migration, production dependency, or cross-user data surface.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `progress-history`: Extend calendar history with a filterable desktop-default weekly journal, private medicine events, and a transparent nutrient-density rating for saved foods and individual entries while preserving existing monthly and mobile behavior.

## Impact

- Affected UI: Progress calendar controls, desktop event filters and layout, food-library and entry nutrient-density labels, and week/day empty and future states.
- Affected client logic: calendar range generation, event grouping/filtering, deterministic nutrient-density classification, bounded history loading, and responsive default selection.
- Affected tests: calendar date-range helpers, nutrient-density gates, private medicine-event mapping, and weekly journal rendering/view-model behavior.
- API and storage: extend `/api/app/history` and `HistoryResponse` with medicine events assembled from existing private tables; no schema or migration changes.
