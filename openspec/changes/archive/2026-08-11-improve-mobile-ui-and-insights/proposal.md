## Why

Calorie’s one-handed journal needs rapid food logging, safe fixed mobile chrome, and nutrition history that explains change, target coverage, confidence, and a practical next step. The original implementation briefly used a fifth Insights destination; a later product decision intentionally merged those analytics into Progress and restored the four-destination Today, Progress, Foods, and You shell. This change now records and finishes that current product truth without changing the calm botanical identity or medical-safety boundary.

## What Changes

- Keep all four current mobile destinations visible while hardening fixed-surface safe-area spacing and overlap behavior for the bottom bar, sheets, and toasts.
- Recompose Today around rapid food logging, compact transparent target feedback, and progressive disclosure for lower-frequency tracking.
- Replace the disabled empty-library “Saved food” state with an in-flow option to save a direct entry as a reusable food for future one-tap logging.
- Replace judgmental daily-rating language with factual target-coverage feedback that names the visible factors.
- Add actionable Insights within Progress with selected-window target coverage, an equal prior-window comparison when recorded data is available, food variety and repeat patterns, data-confidence context, and one informational takeaway.
- Retain 7- and 30-day views, existing food rankings, local-first storage, privacy boundaries, non-medical language, and the four-destination navigation model.

## Capabilities

### New Capabilities
- `actionable-insights`: Explain food-history patterns, selected-period change, target coverage, data confidence, and one non-prescriptive practical takeaway.

### Modified Capabilities
- `adaptive-app-shell`: The current primary navigation and fixed mobile surfaces must remain fully visible, reachable, and safe-area aware across supported widths.
- `daily-intake-log`: Today must prioritize quick food logging and show target feedback as transparent, non-moral context.
- `progress-history`: Bounded history views must distinguish logged from missing days and may compare a selected period with the prior equal period.

## Impact

- `src/components/AppShell.tsx`, `src/styles.css`, `src/pages/TodayPage.tsx`, `src/pages/ProgressPage.tsx`, and new or expanded client-side analytics and calendar helpers and tests.
- No backend route, schema, migration, production dependency, deploy, or change to cross-user isolation.
- Updates the existing app-shell, daily-log, and history specifications and introduces an actionable-insights specification.
