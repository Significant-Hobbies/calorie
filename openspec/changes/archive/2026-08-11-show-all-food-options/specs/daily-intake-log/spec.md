## MODIFIED Requirements

### Requirement: Reusable food definitions
The system SHALL save private foods with calories, carbs, protein, and fibre
defined either per 100 grams or per named unit with a default serving. When a
user selects a reusable food for logging, the system SHALL make every active
food owned by that user available without a fixed item-count cap.

#### Scenario: Per-100-gram food
- **WHEN** a user logs 150 g of a food defined per 100 g
- **THEN** each stored macro total equals 1.5 times the food definition

#### Scenario: Per-unit food
- **WHEN** a user logs two units of a food defined per unit
- **THEN** each stored macro total equals two times the unit definition

#### Scenario: Select from a library larger than 20 foods
- **WHEN** a signed-in user opens the reusable-food selector with more than 20
  active saved foods
- **THEN** every active food owned by that user is available in recent-use then
  alphabetical order

#### Scenario: Exclude unavailable foods
- **WHEN** the reusable-food selector is populated
- **THEN** archived foods and foods owned by other users are not available

### Requirement: Timestamped food entries
The system SHALL store the eaten time, food-name snapshot, amount, unit, and
four macro totals for each entry. The current-day view SHALL include only entries
whose eaten time belongs to that displayed date in the dashboard timezone,
including during optimistic updates.

#### Scenario: Food definition changes
- **WHEN** a saved food is edited after earlier entries exist
- **THEN** historical entries retain their original macro snapshots

#### Scenario: Log food for yesterday
- **WHEN** a user saves an entry dated yesterday while viewing Today
- **THEN** the entry is saved without appearing temporarily in Today's list or
  totals

#### Scenario: Move an entry out of today
- **WHEN** a user edits a current-day entry so its eaten time belongs to another
  date
- **THEN** the entry is removed immediately from Today's list and totals
