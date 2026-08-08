## Purpose

Let the owner shape the incomplete daily-action queue around their real routine while keeping the underlying food, water, weight, and medication tools available.

## ADDED Requirements

### Requirement: Configurable daily prompts
The system SHALL let the owner independently enable or disable weight, creatine, food, and water prompts and SHALL preserve the normal logging surfaces regardless of prompt visibility.

#### Scenario: Disable weight prompt
- **WHEN** the owner disables the weight prompt
- **THEN** Today omits that top-level action on future days while weight check-ins remain available in Progress

#### Scenario: Legacy prompt defaults
- **WHEN** an existing profile has no saved prompt preferences
- **THEN** all four prompts remain enabled in the established weight, creatine, food, water order

### Requirement: Owner-defined prompt order
The system SHALL let the owner arrange the four prompt types in a stable order using keyboard- and touch-accessible controls.

#### Scenario: Move water first
- **WHEN** the owner moves water above the other actions and saves
- **THEN** incomplete enabled prompts render with water first on Today

#### Scenario: Completed prompt
- **WHEN** an enabled prompt is complete for the local day
- **THEN** it remains hidden for that day without changing the saved order of the remaining prompt types

### Requirement: Private preference parity
The system SHALL persist daily-prompt settings in local, demo, and authenticated cloud journals and MUST scope cloud preferences to the authenticated user.

#### Scenario: Open the journal on another signed-in device
- **WHEN** the same authenticated user loads their journal after saving prompt preferences
- **THEN** Today uses the saved enabled set and order
