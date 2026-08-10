# daily-intake-log Specification

## Purpose
Define the finished daily food, nutrient, water, and reusable-food logging
experience.
## Requirements
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

### Requirement: Direct food entries
The system SHALL allow a user to log a food entry by supplying a name, amount,
unit, calories, carbs, protein, fibre, and eaten time without creating or
selecting a reusable food.

#### Scenario: Log a one-off food
- **WHEN** the user saves valid direct entry values
- **THEN** the entry appears in the daily log and contributes its nutrient
  snapshots to daily totals without appearing in the saved-food library

#### Scenario: Edit a direct entry
- **WHEN** the user opens and changes an existing direct entry
- **THEN** the system updates that entry's snapshots without creating a saved
  food

#### Scenario: Recover an entry whose food was deleted
- **WHEN** the user opens an entry whose reusable food no longer exists
- **THEN** the editor shows its retained snapshots as a direct entry

#### Scenario: Reject invalid direct nutrients
- **WHEN** a direct entry has a missing name or unit, a non-positive amount, a
  negative nutrient value, or an invalid eaten time
- **THEN** the system does not save it and explains what must be corrected

### Requirement: One-tap favourite and recent logging
The system SHALL show favourite and recent foods with their default amount and
SHALL log that amount from one primary tap with immediate Undo.

#### Scenario: Quick-add food
- **WHEN** the user taps a favourite food shortcut
- **THEN** the entry appears immediately with the current time and default amount

#### Scenario: Undo quick-add
- **WHEN** the user chooses Undo after a quick add
- **THEN** the system removes or cancels that specific entry

### Requirement: Water logging
The system SHALL log timestamped water amounts in millilitres, provide one-tap
presets for common amounts, and continue accepting water above the saved daily
target. The target SHALL be presented as a reference rather than a limit.

#### Scenario: Add a glass
- **WHEN** the user taps the 250 ml water preset
- **THEN** today's water total increases by 250 ml

#### Scenario: Exceed water target
- **WHEN** the user logs water after today’s total has met or exceeded the target
- **THEN** the controls remain available and the UI shows the actual total and percentage above 100%

### Requirement: Daily totals
The system SHALL aggregate calories, carbs, protein, fibre, and water for the
user's local calendar day.

#### Scenario: Local day boundary
- **WHEN** the user's timezone crosses midnight
- **THEN** the Today view starts a new set of daily totals without changing history
