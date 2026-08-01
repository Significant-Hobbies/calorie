## Why

Calorie’s core mobile navigation has a verified five-tab/four-column layout defect, and the current Insights page reports rankings without explaining change, target coverage, confidence, or a practical next step. Fixing the foundation and making history actionable will improve the one-handed journal experience without changing its calm botanical identity or medical-safety boundary.

## What Changes

- Repair the five-tab mobile navigation, fixed-surface safe-area spacing, and overlap behavior for the bottom bar, sheets, and toasts.
- Recompose Today around rapid food logging, compact transparent target feedback, and progressive disclosure for lower-frequency tracking.
- Replace the disabled empty-library “Saved food” state with an in-flow option to save a direct entry as a reusable food for future one-tap logging.
- Replace judgmental daily-rating language with factual target-coverage feedback that names the visible factors.
- Add an actionable Insights surface with selected-window target coverage, prior-window comparison when available, food variety and repeat patterns, data-confidence context, and one informational takeaway.
- Retain 7- and 30-day views, existing food rankings, local-first storage, privacy boundaries, and non-medical language.

## Capabilities

### New Capabilities
- `actionable-insights`: Explain food-history patterns, selected-period change, target coverage, data confidence, and one non-prescriptive practical takeaway.

### Modified Capabilities
- `adaptive-app-shell`: The primary navigation and fixed mobile surfaces must remain fully visible, reachable, and safe-area aware across supported widths.
- `daily-intake-log`: Today must prioritize quick food logging and show target feedback as transparent, non-moral context.
- `progress-history`: Bounded history views must distinguish logged from missing days and may compare a selected period with the prior equal period.

## Impact

- `src/components/AppShell.tsx`, `src/styles.css`, `src/pages/TodayPage.tsx`, `src/pages/InsightsPage.tsx`, `src/lib/daily-rating.ts`, and new or expanded client-side analytics helpers and tests.
- No backend route, schema, migration, production dependency, deploy, or change to cross-user isolation.
- Updates the existing app-shell, daily-log, and history specifications and introduces an actionable-insights specification.
