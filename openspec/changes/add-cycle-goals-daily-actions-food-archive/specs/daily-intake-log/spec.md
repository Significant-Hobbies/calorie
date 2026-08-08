## ADDED Requirements

### Requirement: Incomplete daily action queue
The Today view SHALL give weight check-in, creatine, food, and water prominent top-level actions while each action is incomplete for the user’s local calendar day.

#### Scenario: Start an unlogged day
- **WHEN** none of the four daily actions is complete
- **THEN** Today shows four reachable, clearly labelled top-level actions before detailed targets and logging panels

#### Scenario: Complete weight check-in
- **WHEN** a weight entry is recorded within the current local day
- **THEN** the weight top-level action is removed for that day

#### Scenario: Complete food logging
- **WHEN** the first food entry is recorded within the current local day
- **THEN** the food top-level action is removed while the standard food logger remains available for later meals

#### Scenario: Complete water logging
- **WHEN** the first water entry is recorded within the current local day
- **THEN** the water top-level action is removed while the standard water presets remain available

#### Scenario: Complete creatine check-in
- **WHEN** the active Creatine routine is checked in for the current local day
- **THEN** the creatine top-level action is removed while routine management remains available

#### Scenario: No creatine routine exists
- **WHEN** the creatine top-level action is used without an active Creatine routine
- **THEN** the routine editor opens with “Creatine” prefilled and no check-in is recorded until the user saves and confirms it

#### Scenario: All daily actions are complete
- **WHEN** all four daily actions have been completed
- **THEN** no daily-action CTA remains and the interface announces the completed state without blocking further logging

### Requirement: Reversible reusable-food archiving
The system SHALL allow a user to archive and restore their own reusable foods without changing historical food-entry snapshots.

#### Scenario: Archive a reusable food
- **WHEN** the user confirms Archive for an active reusable food
- **THEN** the food no longer appears in active library results, quick logging, entry pickers, or completion suggestions

#### Scenario: Preserve historical entries
- **WHEN** a reusable food with earlier entries is archived
- **THEN** every earlier entry retains its food name, amount, unit, calories, carbs, protein, fibre, and eaten time

#### Scenario: Browse archived foods
- **WHEN** the user opens the Archived library view
- **THEN** only that user’s archived foods are listed with Restore and separately confirmed permanent-delete actions

#### Scenario: Restore an archived food
- **WHEN** the user restores an archived food
- **THEN** it returns to the active library and becomes eligible for logging shortcuts and suggestions

#### Scenario: Permanent deletion remains explicit
- **WHEN** the user chooses permanent deletion from the Archived view
- **THEN** the system requires confirmation and preserves historical entry snapshots after deleting the reusable definition
