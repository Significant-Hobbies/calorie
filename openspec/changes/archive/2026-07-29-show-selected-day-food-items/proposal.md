## Why

The calendar summarizes nutrition totals for a selected day but does not show
which foods produced them. Showing the underlying entries makes history useful
for quickly recalling what was eaten without leaving the Progress page.

## What Changes

- Include bounded food-entry detail in calendar-history responses.
- Show the selected date's food entries in chronological order beneath its
  nutrition summary.
- Present each entry's time, food name, amount, calories, and macro summary.
- Preserve the existing neutral no-log state for dates without journal data.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `progress-history`: Selected-day history also shows the food entries recorded
  on the selected local date.

## Impact

This changes the calendar-history response produced by local, demo, and
signed-in data paths, plus the existing `HistoryCalendar` detail UI and its
styles. It adds no dependency, migration, route, or deployment requirement.
