## Why

Rolling charts make recent averages visible, but they do not help a user answer
"what happened on that day?" A month calendar makes sparse food, water, fasting,
and weight history easier to scan and revisit without replacing the existing
trend view.

## What Changes

- Add Calendar and Trends views to Progress, with Calendar as a true navigable
  month grid.
- Summarize whether each date has nutrition, hydration, fasting, or weight data.
- Let the user select a past or current date to see its full nutrient, water,
  fasting, and weight details.
- Extend history reads to accept an exact bounded date range in local, demo, and
  signed-in Cloudflare-backed modes.
- Keep future days inactive and preserve neutral, non-punitive language for
  empty and out-of-range days.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `progress-history`: Add navigable calendar history and selected-day detail to
  the existing bounded history experience.

## Impact

The Progress React surface, history API client, local/demo history adapters,
Cloudflare Worker history route, shared history types, styles, and focused tests
will change. No new runtime dependency or database migration is required.
