## 1. Macro completion suggestions

- [x] 1.1 Add `lib/macro-completion.ts` that computes remaining calories/protein/fibre vs a target and ranks saved foods by how much of the largest deficit one default serving covers
- [x] 1.2 Add unit tests for the helper covering no-target, all-met, calorie-deficit, protein-deficit, and fibre-deficit cases
- [x] 1.3 Render an always-on "Remaining today" panel on `TodayPage` using the helper, with food suggestions and graceful empty/complete states

## 2. Remove favourite from the UI

- [x] 2.1 Remove the "Show in Today's quick picks" toggle from the `FoodsPage` editor
- [x] 2.2 Remove the star icon and favourite-based sort from the `FoodsPage` list; sort by last-used then name
- [x] 2.3 Order Today's quick picks by `lastUsedAt` descending instead of relying on favourite ordering

## 3. Food analytics page

- [x] 3.1 Add `lib/food-analytics.ts` that groups history entries by `foodId ?? foodName` and produces most-logged, biggest calorie contributors, average per-occasion macros, and total occasions
- [x] 3.2 Add unit tests for the analytics helper
- [x] 3.3 Add `pages/InsightsPage.tsx` with a 7/30-day toggle and the analytics views, reusing existing card/section styles
- [x] 3.4 Add `insights` to `AppTab`, the `AppShell` tab list, and lazy-load `InsightsPage` in `App.tsx` via a switch statement

## 4. Inferred daily rating

- [x] 4.1 Add `lib/daily-rating.ts` that infers a 1–5 rating from the average completion share of calorie, protein, fibre, and water targets
- [x] 4.2 Add unit tests for the rating helper
- [x] 4.3 Render the rating on Today's daily summary and in the calendar day detail

## 5. Validation and documentation

- [x] 5.1 Run `pnpm check` (typecheck, tests, lint) and fix any failures
- [x] 5.2 Update the `daily-intake-log` durable spec and add the `food-analytics` spec, then run `openspec validate`
- [x] 5.3 Update `PROJECT_STATUS.md` with the shipped feature and timeline entry
