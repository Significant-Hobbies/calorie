## MODIFIED Requirements

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
