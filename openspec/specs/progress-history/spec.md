# progress-history Specification

## Purpose
TBD - created by archiving change build-calorie-mvp. Update Purpose after archive.
## Requirements
### Requirement: Weight check-ins
The system SHALL store timestamped weight check-ins and show progress toward the
saved target without moral labels.

#### Scenario: New weight
- **WHEN** the user records a valid weight
- **THEN** the system updates the trend and preserves earlier check-ins

### Requirement: Historical statistics
The system SHALL provide bounded 7-day and 30-day statistics for calories,
carbs, protein, fibre, water, completed fasts, and weight.

#### Scenario: Seven-day view
- **WHEN** the user selects the seven-day range
- **THEN** the system shows daily values, range averages, and comparison to targets

#### Scenario: Sparse history
- **WHEN** fewer than two days contain entries
- **THEN** the system shows the available data and a helpful empty-state prompt

### Requirement: Trend interpretation
The system SHALL describe trends with neutral language and SHALL NOT infer
medical outcomes from weight or nutrition history.

#### Scenario: Weight increases
- **WHEN** the plotted weight trend rises
- **THEN** the system reports the measured change without calling it good or bad

