## ADDED Requirements

### Requirement: Private medication definitions
The system SHALL let a user create, edit, and archive private medication
definitions containing a name and one schedule of Morning, Evening, or Either.
Cloud definitions MUST be scoped to the authenticated user and local
definitions MUST remain on that browser.

#### Scenario: Add a morning medication
- **WHEN** the user saves a medicine name with Morning selected
- **THEN** the medicine appears in the Today medication section with a Morning label

#### Scenario: Archive a medication
- **WHEN** the user archives a medication
- **THEN** it no longer appears on future daily checklists and prior check-offs remain stored

#### Scenario: Cross-user access
- **WHEN** an authenticated user requests or mutates a medication id owned by another user
- **THEN** the system returns no medication data and performs no mutation

### Requirement: Daily medication check-offs
The system SHALL present each active medication once per local day and SHALL
let the user toggle one taken/not-taken check-off for that medication and date.

#### Scenario: Mark medication taken
- **WHEN** the user marks an active medication taken
- **THEN** Today immediately shows it complete and stores the local date and taken timestamp

#### Scenario: Undo medication check-off
- **WHEN** the user clears a completed medication
- **THEN** Today immediately shows it incomplete and removes that day’s check-off

#### Scenario: New local day
- **WHEN** the user’s local calendar day changes
- **THEN** active medications appear unchecked for the new day without altering prior dates

### Requirement: Medication safety boundary
The system SHALL treat medication tracking as a private checklist and SHALL NOT
provide dosage, prescribing, interaction, efficacy, or adherence advice.

#### Scenario: Medication editor
- **WHEN** the medication editor is shown
- **THEN** it asks only for a name and schedule and labels the feature as a personal checklist
