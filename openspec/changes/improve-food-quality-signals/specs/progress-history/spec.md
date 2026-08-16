## ADDED Requirements

### Requirement: Transparent tracked food-quality score
The system SHALL replace the ordinal nutrient-density grade with an integer score from 0 through 100 derived only from the calories, protein, and fibre in a saved-food basis or a logged entry's current score basis.

For positive calories, the protein factor SHALL be the protein grams per 100 kcal divided by 8 and capped from 0 through 1. The fibre factor SHALL be the fibre grams per 100 kcal divided by 3 and capped from 0 through 1. The score SHALL equal the rounded result of 70 times the stronger factor plus 30 times the weaker factor.

The presentation SHALL expose the score, both per-100-kcal values, both factors, and the formula. It SHALL describe the result as `Tracked quality` and state that it does not assess ingredients, vitamins, minerals, sodium, added sugars, fat quality, dietary variety, or overall health quality. Carbohydrate and Packaged / Not packaged values SHALL NOT reduce or increase the score.

#### Scenario: Score a saved food
- **WHEN** a saved food has positive calories and tracked protein and fibre values
- **THEN** the system shows its stable 0–100 Tracked quality score
- **AND** the exact nutrient densities, factors, and calculation are available in the explanation

#### Scenario: Rebase a linked historical entry
- **WHEN** a logged entry references a matching non-archived food whose current unit can safely interpret the logged amount
- **THEN** the system derives the entry's score from the latest active food definition scaled by that original amount
- **AND** editing the active food can change that entry's score without rewriting the stored entry

#### Scenario: Fall back to the logged snapshot
- **WHEN** a logged entry is one-off, its food is missing or archived, or its logged amount is incompatible with the current food unit
- **THEN** the system derives the score from the immutable logged nutrient snapshot
- **AND** identifies the logged values as the fallback score basis in the expanded explanation

#### Scenario: One tracked dimension is strong
- **WHEN** one factor reaches 1 and the other is 0
- **THEN** the score is 70 rather than 100

#### Scenario: Both tracked dimensions are strong
- **WHEN** both factors reach 1
- **THEN** the score is 100

#### Scenario: Calories are unavailable for a food score
- **WHEN** a saved food or resolved entry basis has zero or invalid calories
- **THEN** the system presents the score as unavailable instead of dividing by zero or inferring poor quality

#### Scenario: Packaging and carbohydrates are neutral
- **WHEN** otherwise identical inputs differ only in their Packaged / Not packaged value or carbohydrate value
- **THEN** they receive the same Tracked quality score

#### Scenario: Web and native evaluate the same snapshot
- **WHEN** the web and native clients receive the same calories, protein, and fibre snapshot
- **THEN** both clients produce the same score, factors, rounded values, and explanation boundaries

### Requirement: Target-based daily score
For a selected day with food entries, the system SHALL resolve every entry against the latest compatible non-archived food definition with logged snapshots as fallbacks, sum the resulting calories, protein, and fibre, and calculate a separate integer `Daily score` from 0 through 100 against the selected day's visible targets.

The calorie factor SHALL be `calories / lower calorie bound` below the target range, 1 inside the inclusive range, and `1 - 2 × ((calories - upper calorie bound) / upper calorie bound)` above the range, clamped from 0 through 1. A single calorie target SHALL act as both bounds. Calorie credit therefore reaches zero at 50% above the upper bound.

The protein factor SHALL be consumed protein divided by the lower protein target and capped from 0 through 1. The fibre factor SHALL be consumed fibre divided by the fibre target and capped from 0 through 1. The score SHALL combine available factors at weights of 50 for calories, 30 for protein, and 20 for fibre, divide by the sum of weights whose targets are available, multiply by 100, and round to the nearest integer. Amounts above protein or fibre targets SHALL NOT add credit beyond their completed factor.

The presentation SHALL expose the resolved nutrient totals, targets, factors, weights, fallback count, and exact calculation. It SHALL label the current calendar day `Score so far` and a completed past day `Final score`. It SHALL retain the Tracked quality caveat and SHALL NOT describe the daily result as a complete health assessment.

#### Scenario: Complete every tracked target
- **WHEN** a day is inside its calorie range and meets or exceeds its protein and fibre targets
- **THEN** its Daily score is 100

#### Scenario: Exceed the calorie range
- **WHEN** a day exceeds the upper calorie bound while its protein and fibre targets remain met
- **THEN** its calorie factor and Daily score decrease according to the visible excess calculation
- **AND** reaching 50% above the upper bound contributes zero calorie credit

#### Scenario: Protein or fibre improves the day
- **WHEN** protein or fibre increases toward an available target without another input changing
- **THEN** the Daily score increases according to that factor's weight
- **AND** intake beyond the target does not exceed a completed factor of 1

#### Scenario: Recalculate historical days after a food edit
- **WHEN** an active food's calories, protein, or fibre changes
- **THEN** every linked historical day recalculates from the latest compatible definition
- **AND** entries using missing, archived, incompatible, or one-off foods retain their logged fallback basis

#### Scenario: Some daily targets are unavailable
- **WHEN** at least one but not all calorie, protein, or fibre targets is available
- **THEN** the Daily score normalizes only across the weights with available targets
- **AND** the explanation names the omitted target factors

#### Scenario: No daily targets are available
- **WHEN** calorie, protein, and fibre targets are all unavailable
- **THEN** the system presents the Daily score as unavailable rather than inventing targets

#### Scenario: Current day versus completed day
- **WHEN** the selected date is the user's current local calendar day
- **THEN** the score is labelled `Score so far`
- **AND WHEN** the selected date is earlier than the current local calendar day
- **THEN** the score is labelled `Final score`

#### Scenario: Web and native evaluate the same day
- **WHEN** the web and native clients receive the same resolved entry bases and daily targets
- **THEN** both clients produce the same factors, available-weight normalization, rounded Daily score, fallback count, and explanation boundaries

## REMOVED Requirements

### Requirement: Tracked nutrient-density rating

**Reason**: The `High`, `Medium`, and `Low` labels are too coarse to show incremental changes or how foods combine across a day.

**Migration**: Replace every non-persisted invocation of the old rating with the new food, entry, or aggregate daily-menu score. No stored data or API migration is required.
