## 1. Calendar and density models

- [x] 1.1 Add local-date-safe helpers for Monday week starts, seven-day date keys, week shifting, and current-week comparison.
- [x] 1.2 Add focused unit tests for month-boundary, year-boundary, and daylight-saving-adjacent weekly ranges.
- [x] 1.3 Add a pure tracked nutrient-density classifier with exact per-100-kcal inputs, zero-calorie handling, and boundary tests.

## 2. Private history events

- [x] 2.1 Add a normalized medicine history event to shared types and bounded history responses.
- [x] 2.2 Assemble medicine events from existing local and demo medication check-ins without changing stored data.
- [x] 2.3 Join authenticated medicine check-ins to user-owned medicine names inside the requested range, including archived routines, with source tests for user scoping.

## 3. Responsive Progress state and loading

- [x] 3.1 Add desktop-aware Week/Month state with Week as the desktop default and Month enforced below the desktop breakpoint.
- [x] 3.2 Load only the active seven-day or existing month-grid history range and keep selected dates valid while navigating.
- [x] 3.3 Add previous/next week navigation and prevent navigation beyond the current week.

## 4. Weekly journal interface

- [x] 4.1 Add desktop-only Week/Month and All/Food/Weight/Medicine controls with All selected by default.
- [x] 4.2 Render seven semantic day sections with a chronological mixed event list containing food names/times, weight check-ins, and actual medicine check-in times.
- [x] 4.3 Apply the nutrient-density label and explanation to weekly food events, saved-food rows/editors, and individual Today log entries.
- [x] 4.4 Add neutral filtered-empty and future-day states, long-name wrapping, dark-mode treatment, keyboard focus, and a responsive stacked fallback for zoomed or constrained desktop layouts.
- [x] 4.5 Preserve the current monthly grid, selected-day details, and all below-desktop behavior without duplicate hidden content.

## 5. Focused verification

- [x] 5.1 Add view-model coverage for chronological mixed-event grouping, filters, singular counts, empty days, and future dates.
- [x] 5.2 Verify local, demo, and authenticated calendar history use the same bounded additive response without a migration.

## 6. Design review

- [x] 6.1 Create the preserve-lane design receipt and capture the current Calendar view before implementation.
- [x] 6.2 Inspect the completed surface and capture after evidence at 390px, 768px, and 1440px.
- [x] 6.3 Run the Impeccable critique, polish, audit, and detector pass; resolve every P0/P1 and record any advisory findings.
- [x] 6.4 Obtain the owner's final `keep`, `close`, `wrong-lane`, or `delegated` decision and validate the design receipt.

## 7. Repository validation

- [x] 7.1 Run focused tests during implementation, then `pnpm check`, strict OpenSpec validation, and `git diff --check`.
- [x] 7.2 Confirm no dependency, migration, credential, production configuration, commit, push, or deployment change occurred without separate approval.
