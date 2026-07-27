# transparent-guidance Specification

## Purpose
Define transparent deterministic nutrition, eating-gap, exercise-timing, and
sleep-timing guidance.
## Requirements
### Requirement: Transparent daily nutrition targets
The system SHALL calculate an estimated maintenance value, selected goal range,
daily energy range, current protein range, and fibre target from saved profile
inputs and SHALL show the formula inputs, source, and an editable range
override. Gradual loss SHALL use 80–85% of maintenance, faster loss 75–80%,
maintenance 95–105%, and gradual gain 105–110%. Automatic range bounds SHALL
NOT fall below 1,200 kcal/day, and weight-derived protein ranges SHALL use
1.6–2.0 g/kg for loss goals and 1.4–1.8 g/kg for maintenance or gain.

#### Scenario: Complete equation inputs
- **WHEN** age, height, weight, activity, goal, and equation profile are present
- **THEN** the system returns maintenance calories, the signed adjustment range
  actually applied, the daily calorie range, and a plain-language explanation

#### Scenario: Goal changes
- **WHEN** the user changes between gradual loss, faster loss, maintenance, or
  gradual gain
- **THEN** the calorie range changes by the documented maintenance percentages,
  subject to the automatic floor, and the UI identifies the range

#### Scenario: Automatic loss floor
- **WHEN** a requested loss range bound would be lower than 1,200 kcal/day
- **THEN** that bound is 1,200 kcal/day and the displayed signed adjustment
  range matches the bounds actually applied

#### Scenario: Missing equation profile
- **WHEN** the user skipped the energy equation profile
- **THEN** the system omits the automatic energy range and invites a manual
  range while retaining the goal-specific weight-based protein range

#### Scenario: Target weight present
- **WHEN** current and target weight are available
- **THEN** the system uses target weight as a progress destination and does not
  claim that it directly changes the energy formula or guarantees a timeline

#### Scenario: Manual calorie range
- **WHEN** the user supplies valid lower and upper manual calorie bounds
- **THEN** the system uses those exact bounds and does not apply an automatic goal percentage

### Requirement: Completed fasting windows
The system SHALL derive each completed fasting window automatically from the
last caloric food entry on one local eating day to the first caloric food entry
on the following eating day; water entries SHALL NOT start or end a fasting
window. The Today page SHALL show the latest completed duration and endpoints
without requiring a fasting threshold.

#### Scenario: Overnight food gap
- **WHEN** the last food on one local eating day is at 20:00 and the first food
  on the following eating day is at 10:00
- **THEN** the system records and displays a 14-hour completed fasting window
  from 20:00 to 10:00

#### Scenario: Multiple foods in one day
- **WHEN** an eating day contains multiple food entries
- **THEN** only its last food can start the next completed fasting window and
  same-day gaps are not counted as completed fasting windows

### Requirement: Carb-aware exercise timing
The system SHALL derive a broad exercise window from the most recent
carbohydrate entry, SHALL label it “Next best exercise window,” and SHALL
describe it as a practical estimate rather than a requirement or evidence that
the user has not exercised.

#### Scenario: Recent carb-containing meal
- **WHEN** the user logged a carb-containing meal within the prior four hours
- **THEN** the system shows a post-meal exercise window and the carb input used

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
