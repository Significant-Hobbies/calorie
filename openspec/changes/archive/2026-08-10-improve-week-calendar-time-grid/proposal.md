## Why

The desktop weekly journal currently presents each day as a list, so logged times are hard to compare across days and week navigation feels like opaque pagination. A spatial 24-hour calendar will make meal timing immediately legible while keeping the journal fast to browse.

## What Changes

- Replace the desktop weekly event lists with a Monday-to-Sunday 24-hour time grid.
- Render food logs, weight check-ins, and medicine check-ins as positioned calendar events at their actual local times.
- Keep the existing All, Food, Weight, and Medicine filters, with filtered events retaining their time positions.
- Improve week pagination with a visible Today action, clearer previous/next labels, and an explicit week range.
- Reuse recently loaded calendar ranges immediately when moving back and forth, then refresh them without replacing the calendar with a loading skeleton.
- Preserve the existing compact month calendar and selected-day detail below the desktop breakpoint.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `progress-history`: The desktop weekly journal becomes a spatial 24-hour event calendar with explicit, date-aware week navigation.

## Impact

- Affects the Progress calendar React components, calendar/event layout and range-cache helpers, focused tests, and responsive styles.
- Reuses the existing bounded history response and timestamps; no API, database, dependency, or migration change is expected.
