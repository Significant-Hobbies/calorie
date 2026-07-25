# transparent-guidance Specification

## Purpose
Define transparent deterministic nutrition, eating-gap, gym-timing, and
sleep-timing guidance.
## Requirements
### Requirement: Transparent daily nutrition targets
The system SHALL calculate an estimated maintenance value, selected goal
adjustment, daily energy range, current protein range, and fibre target from
saved profile inputs and SHALL show the formula inputs, source, and an editable
override.

#### Scenario: Complete equation inputs
- **WHEN** age, height, weight, activity, goal, and equation profile are present
- **THEN** the system returns maintenance calories, the exact signed goal
  adjustment, the adjusted daily range, and a plain-language explanation

#### Scenario: Goal changes
- **WHEN** the user changes between gradual loss, faster loss, maintenance, or
  gradual gain
- **THEN** the calorie target changes by the documented adjustment and the UI
  identifies that adjustment rather than presenting an unexplained result

#### Scenario: Missing equation profile
- **WHEN** the user skipped the energy equation profile
- **THEN** the system omits the automatic energy target and invites a manual
  target while retaining any weight-based protein range

#### Scenario: Target weight present
- **WHEN** current and target weight are available
- **THEN** the system uses target weight as a progress destination and does not
  claim that it directly changes the energy formula or guarantees a timeline

### Requirement: Completed fasting windows
The system SHALL count gaps between caloric entries that meet the user's fasting
threshold; water entries SHALL NOT end a fasting window.

#### Scenario: Fourteen-hour gap
- **WHEN** two food entries are fourteen hours apart and the threshold is twelve hours
- **THEN** the system counts one completed fasting window

### Requirement: Carb-aware gym timing
The system SHALL derive a broad gym window from the most recent carbohydrate
entry and SHALL label it as a practical estimate rather than a requirement.

#### Scenario: Recent carb-containing meal
- **WHEN** the user logged a carb-containing meal within the prior four hours
- **THEN** the system shows a post-meal training window and the carb input used

#### Scenario: No recent carbohydrate
- **WHEN** there is no recent carb-containing entry
- **THEN** the system explains that food history does not indicate a specific window

### Requirement: Food-aware sleep timing
The system SHALL calculate a wind-down time from the user's wake/sleep routine
and the settling window after the most recent food entry.

#### Scenario: Late heavy meal
- **WHEN** a heavy food entry would place the settling window after the routine bedtime
- **THEN** the system recommends the later time and explains the meal adjustment

### Requirement: Informational safety
The system SHALL describe every recommendation as an estimate and SHALL advise
users with chronic disease, pregnancy, eating-disorder concerns, or special
dietary needs to use professional guidance.

#### Scenario: Methodology disclosure
- **WHEN** the user opens a recommendation explanation
- **THEN** the system shows the rule, source link, and informational limitation

