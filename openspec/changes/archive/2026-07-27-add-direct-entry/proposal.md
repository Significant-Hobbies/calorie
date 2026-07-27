## Why

Logging a one-off meal currently forces the user to create a reusable food
first. That adds unnecessary work to the mobile logging path and clutters the
saved-food library with items the user may never eat again.

## What Changes

- Let the user choose a direct entry from the existing entry sheet.
- Capture a one-off name, amount and unit, calories, carbs, protein, fibre, and
  eaten time without creating a reusable food.
- Store and edit direct entries through the same local, demo, offline, and
  authenticated paths as saved-food entries.
- Keep quick-add and saved-food entry behavior unchanged.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `daily-intake-log`: Entries may be logged from either a reusable food or
  direct nutrient snapshots that do not create a saved food.

## Impact

The Today entry sheet, client entry API, local/demo stores, and Worker entry
routes will accept nullable food IDs plus direct snapshot fields. The existing
D1 schema already permits nullable food IDs, so no migration or new dependency
is required.
