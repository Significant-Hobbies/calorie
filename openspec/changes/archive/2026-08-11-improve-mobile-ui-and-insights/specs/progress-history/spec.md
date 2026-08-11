## MODIFIED Requirements

### Requirement: Historical statistics
The system SHALL provide bounded 7-day and 30-day statistics for calories, carbs, protein, fibre, water, completed fasts, weight, and timestamped food-entry detail. Nutrition summaries SHALL distinguish days with logged food from absent logs and SHALL not interpret absent logs as zero intake.

#### Scenario: Seven-day view
- **WHEN** the user selects the seven-day range
- **THEN** the system shows daily values, range averages, comparison to targets, and timing insights from that bounded range

#### Scenario: Sparse history
- **WHEN** fewer than two days contain entries
- **THEN** the system shows the available daily data and a helpful meal-timing empty-state prompt

#### Scenario: Missing-log context
- **WHEN** a selected history window includes dates without food entries
- **THEN** coverage and pattern summaries identify the logged-day sample rather than using those dates as zero-intake observations
