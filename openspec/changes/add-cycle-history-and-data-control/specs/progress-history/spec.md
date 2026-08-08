## MODIFIED Requirements

### Requirement: Weight check-ins
The system SHALL store timestamped weight check-ins, show progress toward the saved target without moral labels, and let the owner edit or remove their own check-ins from visible history.

#### Scenario: New weight
- **WHEN** the user records a valid weight
- **THEN** the system updates the trend and preserves earlier check-ins

#### Scenario: Correct a weight
- **WHEN** the owner changes the value or recorded time of a weight check-in
- **THEN** the trend and any affected cycle analysis update from the corrected value

#### Scenario: Remove a weight
- **WHEN** the owner confirms removal of an incorrect weight check-in
- **THEN** the entry disappears from history and unsupported trend or cycle-rate claims are removed

#### Scenario: Cross-user weight correction
- **WHEN** an authenticated user attempts to update or delete a weight owned by another user
- **THEN** the system performs no mutation and returns no weight data

## ADDED Requirements

### Requirement: Cycle-focused Progress summary
Progress SHALL lead cycle analytics with the active cycle and date range, a transparent status, elapsed days, logged-day coverage, average intake versus plan, and supported weight movement before lower-level charts.

#### Scenario: Open populated cycle analytics
- **WHEN** the active cycle has sufficient logged data
- **THEN** the owner can understand the current cycle signal without calculating across separate charts

#### Scenario: Open sparse cycle analytics
- **WHEN** cycle data is insufficient
- **THEN** the summary names the missing sample and keeps available measurements neutral rather than filling absent values with zero
