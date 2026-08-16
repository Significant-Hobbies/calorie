## Why

Calorie's current `High`, `Medium`, and `Low` nutrient-density labels are coarse, freeze historical quality against stale food definitions, and do not explain whether a completed day matched the user's energy and tracked nutrient targets. Transparent food and daily scores can make those changes visible while still showing exactly which tracked values moved them.

## What Changes

- Replace the ordinal density grade with a derived 0–100 `Tracked quality` score for each saved food and logged entry.
- Rebase a linked historical entry's score and score-only nutrient basis onto its latest matching non-archived food definition, scaled by the originally logged amount. Preserve the stored entry and fall back to its snapshot when no compatible active food exists.
- Replace the density-only daily-menu score with a target-based 0–100 `Daily score`: 50% calorie adherence, 30% protein completion, and 20% fibre completion.
- Give full calorie credit inside the target range, scale credit up below the range, and reduce it twice as quickly above the range so calorie credit reaches zero at 50% over the upper bound.
- Present the current day as `Score so far` and completed past dates as `Final score`.
- Calculate protein and fibre factors against visible density benchmarks, weight the stronger factor at 70% and the complementary factor at 30%, and expose the complete calculation.
- Keep each food's own density score stable when unrelated foods are logged while allowing active food edits to re-evaluate linked history and its derived daily scores.
- State plainly that the score does not assess ingredients, vitamins, minerals, sodium, added sugars, fat quality, dietary variety, or overall health quality.
- Keep `Packaged` / `Not packaged` and carbohydrate values as neutral context; neither changes the score.
- Derive every score from canonical active-food definitions, entry fallbacks, and profile targets without rewriting historical entries, adding persisted score fields, or syncing app-only state.
- Use the same constants, rounding, explanations, and boundary fixtures in web and native clients.
- Remove the old `High`, `Medium`, and `Low` density terminology from user-facing surfaces.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `progress-history`: Replace the ordinal tracked nutrient-density rating with transparent 0–100 food and entry scores plus a target-based daily score across saved foods, Today, and history; linked history follows the latest compatible active food definition.

## Impact

- Affects the pure TypeScript nutrient-density helper, badge component, saved-food, Today, and history surfaces and their tests.
- Adds an equivalent pure Swift calculation and compact native presentation on the corresponding daily-use surfaces.
- Does not change D1, Worker APIs, migrations, authentication, Apple integrations, stored historical entry snapshots, or the calories/carbs/protein/fibre storage contract.
- Uses no new production dependency and makes no medical or complete-diet claim.
