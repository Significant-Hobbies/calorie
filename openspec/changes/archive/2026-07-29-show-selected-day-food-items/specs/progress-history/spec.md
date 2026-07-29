## MODIFIED Requirements

### Requirement: Selected-day history
The system SHALL show calories, carbs, protein, fibre, water, completed fasts,
recorded weight, and timestamped food entries for the selected calendar date.

#### Scenario: Select a logged date
- **WHEN** the user selects a date with history
- **THEN** the system shows that date's available totals and weight check-ins
  without changing stored data
- **AND** if the date has recorded food entries, the system shows them in
  chronological order with their time, food name, amount, calories, carbs,
  protein, and fibre

#### Scenario: Select a logged date without food entries
- **WHEN** the user selects a date with water, fasting, or weight history but no
  food entries
- **THEN** the system shows the available daily history and a neutral no-food
  state

#### Scenario: Select an empty date
- **WHEN** the user selects a past or current date without history
- **THEN** the system shows a clear no-log state without treating the date as a
  failure
