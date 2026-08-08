## ADDED Requirements

### Requirement: Cycle choice during onboarding
The onboarding flow SHALL present Cut, Gain, and Recomposition using the same labels and calculation rules as Settings without adding an onboarding step.

#### Scenario: Select a cycle while onboarding
- **WHEN** a new user selects a cycle
- **THEN** the personalized plan immediately previews that cycle’s calorie and protein guidance

#### Scenario: Select Cut while onboarding
- **WHEN** a new user selects Cut
- **THEN** the same step exposes the gentle and steady intensity choices and retains the selected intensity in the personalized plan

### Requirement: Editable cycle assumption
The system SHALL let the user review and change the active cycle and any Cut intensity alongside the other consequential target assumptions.

#### Scenario: Save a cycle change in Settings
- **WHEN** the user saves a valid cycle selection
- **THEN** the profile persists the selection in local, demo, or private cloud mode and Today reflects the updated guidance
