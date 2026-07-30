## Context

Calorie is a local-first React + Vite app with mirrored local/demo/cloud paths.
`getDashboard()` returns today's entries, totals, target, and saved foods.
`getHistory(7 | 30)` returns per-day totals plus a flat `entries` array
(`HistoryResponse.entries`), each entry carrying `foodName`, `foodId`,
calories/carbs/protein/fibre, amount, unit, and `eatenAt`. The saved-food
editor exposes a `favourite` boolean that drives a star icon and sort priority
on the Foods list and influences which foods surface as quick picks on Today.

## Goals / Non-Goals

**Goals:**

- Show, on Today, how many calories/protein/fibre remain against the day's
  target and name the saved foods that best close the gap.
- Stop using `favourite` anywhere in the UI; order quick picks and the Foods
  list by last-used recency.
- Add a dedicated Insights tab with food-level analytics over 7/30 days.

**Non-Goals:**

- Removing the `favourite` column from D1 or local storage (kept for backward
  compatibility; just unused by the UI).
- New backend routes or schema migrations.
- Medical or prescriptive nutrition advice; suggestions are informational
  estimates from the user's own saved foods.
- Replacing the Progress page; Insights is a separate tab focused on foods.

## Decisions

1. **Compute analytics client-side from history entries.** The history
   payload already includes per-entry data, so no new endpoint is needed.
   Group by `foodId ?? foodName` to handle both saved and direct entries.

2. **Rank completion suggestions by the largest remaining macro gap.** Compute
   remaining calories, protein, and fibre vs target. Whichever tracked macro
   has the largest deficit drives the sort; score each saved food by how much
   of that deficit one default serving covers, then surface the top few. Hide
   the panel when no target is set or all tracked macros are met.

3. **Drop favourite from the UI but keep the field.** `Food.favourite` stays in
   types and storage; the editor no longer renders the toggle, the Foods list
   no longer shows the star or sorts by favourite, and Today quick picks use
   `lastUsedAt` descending. New foods are still created with `favourite: true`
   in `emptyFood()` so storage stays consistent, but the value is never read.

4. **Insights is a 5th primary tab.** Add `insights` to `AppTab` and the tab
   list in `AppShell`, lazy-load `InsightsPage` in `App.tsx` via a switch
   statement (replacing the ternary chain).

5. **Daily rating is inferred, not stored.** `lib/daily-rating.ts` computes a
   1–5 rating from the average clamped completion share of calorie, protein,
   fibre, and water targets. No new table, route, or user input. Shown on
   Today's daily summary and in the calendar day detail. Hidden when no
   targets are set.

## Data flow

```mermaid
flowchart LR
  H[getHistory 7/30] --> EN[entries[]]
  EN --> FA[food-analytics.ts]
  FA --> IP[InsightsPage]
  D[getDashboard] --> T[totals + target + foods]
  T --> MC[macro-completion.ts]
  MC --> TP[TodayPage remaining panel]
```
