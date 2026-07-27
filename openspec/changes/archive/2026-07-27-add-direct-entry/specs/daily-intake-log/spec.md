## ADDED Requirements

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
