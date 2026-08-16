## 1. Shared Evaluation Contract

- [x] 1.1 Replace the TypeScript ordinal density classifier with a pure 0–100 evaluator and aggregate-daily-menu helper covering factor caps, rounding, invalid calories, compositional changes, and neutral packaging/carbohydrate inputs.
- [x] 1.2 Add the equivalent Swift evaluator and matching boundary fixtures so identical individual and aggregate nutrient snapshots produce identical scores, factors, rounded values, and caveats.
- [x] 1.3 Confirm the change adds no D1 column, Worker payload field, persisted score, required logging input, or native-only sync intent.
- [x] 1.4 Add a pure TypeScript entry-basis resolver and target-based Daily score evaluator covering active foods, fallbacks, calorie range penalties, missing-target normalization, and provisional/final labels.
- [x] 1.5 Add the equivalent Swift resolver and Daily score evaluator with matching weights, provenance, factors, rounding, and explanation boundaries.

## 2. Web Experience

- [x] 2.1 Replace the existing nutrient-density badge with a compact, accessible Tracked quality score and exact expandable calculation.
- [x] 2.2 Rebase linked Today and historical entry scores onto the latest compatible non-archived food definition, with labelled logged-snapshot fallbacks.
- [x] 2.3 Replace the density-only daily-menu score with target-based `Score so far` and `Final score` presentations on Today and selected-day history.
- [x] 2.4 Extend focused component and evaluator coverage for active-food edits, archived/missing/incompatible fallbacks, calorie penalties, target completion, and missing-target normalization.

## 3. Native Experience

- [x] 3.1 Add a reusable native Tracked quality score presentation using semantic SwiftUI text, adaptive layout, and non-colour labels.
- [x] 3.2 Rebase linked native Today and historical entry scores onto the latest non-archived food definition while preserving logged fallbacks and the logging path.
- [x] 3.3 Replace the density-only native daily-menu score with the target-based provisional/final Daily score on Today and selected-day history.
- [x] 3.4 Extend native parity, fallback, history-recalculation, accessibility, and primary-journey tests for the revised model.

## 4. Product Review And Verification

- [x] 4.1 Run the preserve-mode design workflow, inspect web and simulator screenshots, and resolve P0/P1 issues without changing the established botanical visual language.
- [x] 4.2 Run targeted tests first, then `pnpm quality`, the full native check, the Release simulator build, `git diff --check`, and strict OpenSpec validation.
- [x] 4.3 Document any physical VoiceOver or iPad checks that remain owner-side; do not release, migrate, or deploy without explicit approval.
