## ADDED Requirements

### Requirement: Actionable nutrition insights
The system SHALL summarize a selected 7-day or 30-day food-history window with food patterns, available target coverage, logging confidence, and one informational practical takeaway derived only from the user’s recorded data.

#### Scenario: Logged history is available
- **WHEN** the user opens Progress Trends with at least one food entry in the selected window
- **THEN** the system shows the number of logged days and entries, food-pattern evidence, and a clearly labeled informational takeaway

#### Scenario: Sparse history
- **WHEN** fewer than two calendar days in the selected window contain food entries
- **THEN** the system explains that the history is too limited for a reliable pattern and invites continued normal logging without assigning a negative rating

### Requirement: Transparent target coverage
The system SHALL show coverage against each available calorie, protein, fibre, and water target using only logged days, and SHALL identify unavailable targets or missing logs instead of treating either as zero completion.

#### Scenario: Partial target configuration
- **WHEN** one or more daily targets are not configured
- **THEN** the system omits those measures from coverage and states that only configured targets are included

### Requirement: Neutral historical comparison
The system SHALL request one equal prior bounded period, show a selected-window comparison only when recorded food is available in both periods, label the selected period accurately, and describe differences neutrally without medical or moral conclusions.

#### Scenario: Prior period unavailable
- **WHEN** the history payload does not include a complete comparable earlier period
- **THEN** the system shows the selected-period value without fabricating a comparison
