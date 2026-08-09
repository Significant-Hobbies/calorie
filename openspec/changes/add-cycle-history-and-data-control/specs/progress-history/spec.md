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

### Requirement: Progress chart annotations remain visually distinct
Every Progress graph SHALL reserve visible space between the plotted area and its x-axis labels, legend, or explanatory note at supported widths and text zoom.

#### Scenario: Read a graph annotation
- **WHEN** a Progress graph includes labels, a legend, or a note below the plot
- **THEN** the annotation does not touch or visually merge with the plotted area

### Requirement: Progress remains exact and correct at the edges
Progress SHALL expose each plotted value in an accessible table, preserve a weight check-in's local calendar date during correction, use valid list semantics, and keep interactive metric controls at least 44 CSS pixels tall.

#### Scenario: Review exact chart values without sight
- **WHEN** assistive technology reaches a populated Progress chart
- **THEN** every plotted date and value is available in a captioned table in addition to the chart summary

#### Scenario: Edit an early-morning weight check-in
- **WHEN** the owner edits a check-in recorded after local midnight but before the corresponding UTC date changes
- **THEN** the date input opens on the original local calendar day

#### Scenario: Read sparse summaries and operate chart filters
- **WHEN** Progress has singular counts or no configured calorie range
- **THEN** the copy is grammatical, no placeholder range is announced, ranked foods keep valid list structure, and metric filters meet the 44 CSS pixel touch-target floor
