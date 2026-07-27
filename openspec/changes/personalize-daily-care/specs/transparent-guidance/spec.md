## MODIFIED Requirements

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
