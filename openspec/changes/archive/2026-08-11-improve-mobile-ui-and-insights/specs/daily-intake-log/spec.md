## MODIFIED Requirements

### Requirement: One-tap favourite and recent logging
The system SHALL show recent foods with their default amount and SHALL make rapid food logging the most prominent task on Today while retaining immediate Undo.

#### Scenario: Open Today
- **WHEN** the user opens Today on a phone
- **THEN** rapid food logging is reachable before lower-frequency tracking and detailed historical content

#### Scenario: Undo quick-add
- **WHEN** the user chooses Undo after a quick add
- **THEN** the system removes or cancels that specific entry

### Requirement: Save a direct entry for reuse
The system SHALL keep the saved-food option available when no foods exist and SHALL let a user save a valid direct entry as a reusable food without leaving the entry flow.

#### Scenario: First reusable food from an entry
- **WHEN** the user chooses to save a valid direct entry for reuse
- **THEN** the system stores a reusable food with nutrient values scaled to its entered serving, logs the current entry, and makes that food available for future one-tap logging

#### Scenario: Empty saved-food library
- **WHEN** the user opens a new entry and has no saved foods
- **THEN** the saved-food control explains how to add one rather than remaining disabled

### Requirement: Transparent daily feedback
The system SHALL present progress against configured daily targets as factual coverage, identify the included factors, and avoid evaluative or moral labels.

#### Scenario: Partial completion
- **WHEN** configured daily targets are only partly covered
- **THEN** the system names the target areas still in view without describing the day or user as good, bad, excellent, or slow
