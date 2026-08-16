## Context

See `proposal.md` for motivation. The current web helper computes a `High`, `Medium`, or `Low` label from protein and fibre per 100 kcal. The same D1 food and entry records are now consumed by web and native, but native does not yet present this assessment. The product contract intentionally stores only calories, carbs, protein, and fibre, and logging must remain fast.

Authoritative healthy-diet guidance describes quality through adequacy, balance, moderation, and diversity, including food variety and nutrients Calorie does not store. The requested score must therefore remain explicitly scoped to the protein and fibre Calorie can verify.

## Goals / Non-Goals

**Goals:**

- Make every displayed number reproducible from the canonical active-food definitions, entry fallbacks, daily targets, and selected date.
- Show incremental and compositional changes that the current three bands hide.
- Keep web and native outputs deterministic and contract-tested.
- Preserve immediate logging and the existing D1 schema.

**Non-Goals:**

- Adding sodium, added sugar, saturated fat, micronutrients, ingredients, barcode data, or a processing taxonomy.
- Prescribing intake, claiming a complete health score, or introducing a leaderboard or streak.
- Persisting a derived label, rewriting historical entries, or using Packaged / Not packaged as a proxy for quality.
- Syncing native-only preferences or local journal annotations.

## Decisions

### 1. Produce a 0–100 score from two capped density factors

For positive calories, the evaluator calculates protein grams and fibre grams per 100 kcal. The protein factor is `clamp(proteinPer100Kcal / 8, 0, 1)` and the fibre factor is `clamp(fibrePer100Kcal / 3, 0, 1)`. The final score is `round(70 × max(factors) + 30 × min(factors))`.

This makes one clearly strong tracked dimension worth at most 70 while reserving the remaining 30 points for complementary strength. A result of 100 therefore means both tracked dimensions reached their visible benchmarks, not that the food or day is perfectly healthy.

Alternative considered: an equal 50/50 average. Rejected because a food that is clearly useful for either protein or fibre would appear artificially poor. Taking only the stronger factor was rejected because it would make complementarity invisible.

### 2. Keep saved-food scores stable and let active definitions re-evaluate linked history

An individual saved food is scored from its saved nutrient basis. A linked entry first looks up its food ID in the current non-archived food collection. When the logged amount and current unit remain compatible, the clients scale the latest food definition by the original amount and use that result as the entry's score basis. One-off entries, missing or archived foods, and incompatible units use the stored nutrient snapshot instead. Neither path mutates the entry.

This means refining an active food can raise or lower every linked historical rating while preserving the historical record and a deterministic fallback. Logging an unrelated food never changes a saved food's own score.

Alternative considered: rewrite entry snapshots after a food edit. Rejected because it would change stored history, require sync mutations, and make rollback and conflict resolution materially riskier.

### 3. Resolve a score-only nutrient projection

The resolver returns nutrients plus provenance (`current-food` or `logged-fallback`). Web treats an entry as compatible only when its current active food uses the same unit label as the logged entry; native retains its existing serving-count semantics and scales the matched food by the logged serving count. The projection is used only for item and daily scoring. Existing logged-entry payloads, diary correction behavior, and sync intents remain unchanged.

Alternative considered: silently re-interpret amounts after a unit change. Rejected because `100 g` cannot safely become `100 servings`; falling back is more honest than manufacturing precision.

### 4. Calculate a target-based Daily score separately from food density

The daily evaluator sums the resolved score-basis calories, protein, and fibre. It then derives three capped factors:

- Calories: `calories / lowerBound` below the range, `1` inside the range, and `1 - 2 × ((calories - upperBound) / upperBound)` above it, clamped to 0–1. A single target supplies both bounds.
- Protein: `protein / lowerProteinTarget`, clamped to 0–1.
- Fibre: `fibre / fibreTarget`, clamped to 0–1.

The score is `round(100 × weightedFactors / availableWeights)`, using weights of 0.50 calories, 0.30 protein, and 0.20 fibre. Missing target factors are omitted from both numerator and denominator; no available targets yields an unavailable score. Extra protein or fibre cannot exceed factor 1. The result includes resolved totals, factors, targets, weights, fallback count, and a complete explanation.

This separates two useful questions: a food's Tracked quality describes protein/fibre density, while the Daily score describes how the day's energy and tracked nutrients align with the user's targets. The current day is explicitly provisional (`Score so far`); past dates are `Final score`.

Alternative considered: retain the density-only daily aggregate. Rejected because it does not penalize excess daily calories against the user's plan and does not reward completing personalized protein or fibre targets. Averaging item scores remains rejected because portion sizes would be lost.

### 5. Keep the evaluators pure and mirror them across clients

TypeScript and Swift each receive pure entry-basis and daily evaluators with the same weights, factor clamping, target fallbacks, provenance counts, rounding rule, and table of boundary fixtures. Cross-language parity lives in tests; no derived result is sent over the API or persisted in D1.

Alternative considered: compute the label in the Worker. Rejected because it would add API coupling for a deterministic presentation rule, complicate local-only mode, and still require offline native behavior.

### 6. Use compact scores with progressive explanation

The web badge remains a compact `72/100 tracked` presentation on Foods, Today entries, and History. Today and selected-day summaries replace `Daily menu` with `Score so far` or `Final score` and expose the target-based breakdown. Native uses the same hierarchy in the food library, quick-log detail, Today, and selected-day history.

Activating or expanding a score reveals the protein density, fibre density, two factors, formula, and scope caveat. The design uses the established botanical surfaces and typography; it avoids red/green grades, progress rings, celebratory animation, streaks, or moral copy. Color may reinforce but never carry the value alone.

## Risks / Trade-offs

- [Users may read 100 as perfectly healthy] → Label the value `Tracked quality`, state that 100 only maxes the two tracked factors, and place the scope caveat in every expanded explanation.
- [Benchmarks remain product choices rather than a universal nutrition standard] → Name the math, centralize constants, test exact boundaries, and avoid regulated terms such as `good source` or health claims.
- [Foods with valuable untracked micronutrients can score low] → Show the exact limited basis and never describe the food or user as bad, unhealthy, or failing.
- [A numeric score can become gamified or punitive] → No streaks, rewards, red danger state, daily target, or instruction to maximize it; present it as one descriptive lens.
- [Editing one active food can move many historical scores] → Name current-food versus logged-fallback provenance, never rewrite entries, and test whole-history recalculation explicitly.
- [An in-progress day can look artificially poor] → Label the current day `Score so far`; reserve `Final score` for completed dates.
- [Missing profile targets can distort fixed weights] → Normalize only across available factors and expose omitted targets in the explanation.
- [Web and native implementations can drift] → Share boundary fixtures in both test suites and require parity scenarios before release.
- [More information can slow logging] → Keep signals read-only and compact; do not add required fields or steps.

## Migration Plan

1. Add and test the active-food entry resolver and target-based daily evaluator without changing persistence.
2. Replace web entry and daily presentations, including current-versus-fallback provenance and provisional/final labels.
3. Add the equivalent native resolution, presentations, daily aggregation, and parity fixtures.
4. Run web, native, accessibility, and Release build gates.
5. Roll back by restoring the previous presentation helper; no stored-data rollback is required.
