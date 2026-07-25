## Context

Progress currently requests a rolling 7- or 30-day history and renders summary
cards plus a calorie bar chart. The Worker already aggregates by local date, but
the shared response type and guest/demo adapters are coupled to those two
ranges. A month grid needs up to 42 consecutive dates and must query older
months without inventing client-only totals.

## Goals / Non-Goals

**Goals:**

- Provide a mobile-first, keyboard-accessible month calendar beside the existing
  trends view.
- Keep local, demo, and signed-in history behavior equivalent.
- Reuse the existing food, water, fasting, weight, and target calculations.
- Allow exact bounded history ranges without a schema migration.

**Non-Goals:**

- Editing or adding entries from the calendar.
- Infinite-range analytics, streaks, grades, or medical interpretation.
- Replacing the existing 7/30-day summaries and chart.

## Decisions

1. Add an exact-range history client function that reuses `/api/app/history`.
   The route will accept a maximum 42-day window and return the requested local
   dates. This avoids a second endpoint and keeps authentication and aggregation
   logic in one place. A dedicated calendar endpoint was considered but would
   duplicate the same query and response.
2. Generalize the history response to include `start` and `end` date keys, with
   `rangeDays` optional for the legacy rolling views. Exact millisecond bounds
   remain request details; stable local date keys are the display contract.
3. Build each six-week calendar grid in a pure date helper. The UI sends the
   grid's local midnight bounds, maps returned `HistoryDay` values by date key,
   and treats all-zero dates as unlogged. A fixed 42-cell grid prevents layout
   jumps between months.
4. Calendar cells expose a day number, a compact calorie value when food was
   logged, and small labelled activity markers for water, fasting, or weight.
   The selected date's card contains the full values. This keeps 44-pixel touch
   targets and readable type instead of shrinking every metric into each cell.
5. Calendar and Trends are a top-level segmented control within Progress.
   Calendar month state is independent from the Trends 7/30-day range, so
   switching views does not discard either selection.

## Risks / Trade-offs

- [A 42-day query slightly exceeds the old 31-day bound] → Keep the hard maximum
  at 42 days and retain indexed, user-scoped timestamp filters.
- [Timezone or daylight-saving changes can create incorrect days] → Generate
  query boundaries with local Date constructors and aggregate signed-in data
  with the explicit browser timezone.
- [Dense calendar content becomes unreadable on narrow phones] → Prioritize day
  number and calories in cells; move full metrics to the selected-day card and
  verify at a narrow mobile viewport.
- [Old clients omit exact date metadata] → Keep the rolling `days` parameter and
  optional response field compatible with the existing request.

## Migration Plan

Deploy the backwards-compatible Worker and client together. No database change
is needed. Rollback is a normal code rollback because existing stored entries
are not modified.

## Open Questions

None.
