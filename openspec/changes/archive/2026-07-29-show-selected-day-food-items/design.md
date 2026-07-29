## Context

The Calendar view already requests one bounded history response for its stable
six-week grid. That response contains daily aggregates and weights in every data
mode, while entry-level food detail is currently returned only for 7- and
30-day Trends requests. `HistoryCalendar` already owns selected-date state and
the selected-day detail panel.

## Goals / Non-Goals

**Goals:**

- Make the existing calendar response sufficient to render food entries for any
  selectable date in the loaded grid.
- Keep date grouping consistent with the app's existing local-date behavior.
- Reuse the incumbent food-row information hierarchy in a read-only history
  list.
- Preserve per-user isolation in signed-in mode and the bounded six-week query.

**Non-Goals:**

- Editing or deleting food entries from Progress.
- Adding a separate selected-day API request or loading state.
- Changing daily aggregate calculations, calendar navigation, or Trends.

## Decisions

1. **Populate the existing optional `HistoryResponse.entries` field for
   calendar requests.** This keeps one shared response shape and avoids a second
   request each time a date is selected. A dedicated day-detail endpoint was
   considered, but it would add latency and repeated request state for data that
   already falls within the bounded calendar query.

2. **Return only entries inside the requested calendar bounds.** Local, demo,
   and signed-in implementations will apply the same start-inclusive,
   end-exclusive bounds already used for aggregates. The signed-in query remains
   scoped to the authenticated user.

3. **Filter the loaded entries by local date in `HistoryCalendar`.** This
   matches the existing calendar key logic and prevents UTC boundaries from
   assigning late-night entries to the wrong visible date.

4. **Render entries as a read-only chronological list.** Each row shows time,
   food name, amount and unit, calories, and carbs/protein/fibre. The list sits
   beneath the daily totals, using dividers and the incumbent tokens rather than
   nested cards.

## Risks / Trade-offs

- **Calendar responses become larger** → Keep the existing maximum six-week
  bounds and select only the entry fields already represented by `FoodEntry`.
- **Local-time grouping can differ by device timezone** → Use the same
  `localDateKey` helper as the calendar and current journal behavior.
- **A day can have non-food data but no food entries** → Show the daily summary
  and a neutral “No food entries” message instead of treating the whole day as
  empty.
