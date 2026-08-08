## Purpose

Define private, date-bounded Cut, Gain, and Recomposition sessions so the journal can preserve earlier plans and interpret the current phase without inventing outcomes.

## ADDED Requirements

### Requirement: One active cycle session
The system SHALL maintain at most one active cycle session per journal, containing a cycle type, local start date, optional local end date, and the calorie/protein plan snapshot used for interpretation.

#### Scenario: Initialize an existing journal
- **WHEN** a legacy journal has a current mapped goal but no cycle session
- **THEN** the system creates an active session for that mapped cycle starting on the current local date without changing earlier entries or claiming they belonged to that cycle

#### Scenario: Cross-user cycle access
- **WHEN** an authenticated user requests or mutates a cycle session owned by another user
- **THEN** the system returns no session data and performs no mutation

### Requirement: Explicit cycle transitions
The system SHALL close the active cycle and start a new active session when the owner saves a different top-level cycle, while a change between Cut intensities SHALL remain within the active Cut session.

#### Scenario: Switch from Cut to Gain
- **WHEN** the owner saves Gain while Cut is active
- **THEN** the Cut session ends immediately before the Gain session begins and earlier journal data remains unchanged

#### Scenario: Change Cut intensity
- **WHEN** the owner changes from gentle Cut to steady Cut
- **THEN** the existing Cut session remains active and its plan snapshot updates to the newly saved guidance

#### Scenario: Save unrelated profile settings
- **WHEN** the owner saves profile fields without changing the top-level cycle
- **THEN** no duplicate cycle session is created

### Requirement: Editable active-cycle start date
The system SHALL let the owner set the active session start date to a valid non-future local date that does not overlap the previous session.

#### Scenario: Backdate the first tracked cycle
- **WHEN** the owner chooses an earlier valid start date for the only cycle session
- **THEN** cycle analytics include journal records on and after that date

#### Scenario: Reject an overlapping date
- **WHEN** the selected start date is before the previous session ended or after the current local date
- **THEN** the system preserves the current date and explains the valid range

### Requirement: Cycle-bounded interpretation
The system SHALL summarize the active cycle with elapsed days, food-logged-day coverage, average calories and protein against the saved plan, measured weight change, and a smoothed weekly weight rate when the sample supports it.

#### Scenario: Sufficient active-cycle data
- **WHEN** the cycle contains at least four food-logged days and at least two weight check-ins spanning seven days
- **THEN** Progress shows the supported averages, coverage, measured change, smoothed weekly rate, and the transparent rules used for the status

#### Scenario: Sparse active-cycle data
- **WHEN** the minimum food or weight sample is absent
- **THEN** Progress labels the status as insufficient data and omits unsupported rate or target conclusions

#### Scenario: Neutral cycle status
- **WHEN** a status is shown
- **THEN** it uses only measured intake, configured target ranges, cycle direction, and documented sample thresholds and does not infer health or medical outcomes

### Requirement: Previous-cycle comparison
The system SHALL compare the active cycle with the immediately preceding closed cycle only when both sessions contain sufficient matching logged data.

#### Scenario: Comparable previous cycle
- **WHEN** both sessions contain supported calorie, protein, and weight values
- **THEN** Progress shows signed differences and identifies each cycle and date range without calling either better or worse

#### Scenario: No comparable cycle
- **WHEN** no closed cycle exists or the samples are not comparable
- **THEN** Progress omits the comparison and states what additional history is needed
