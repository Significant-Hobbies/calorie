## ADDED Requirements

### Requirement: Calendar history
The system SHALL provide a navigable month calendar that summarizes available
nutrition, hydration, completed-fast, and weight data for each local date.

#### Scenario: Open calendar
- **WHEN** the user opens the Calendar view
- **THEN** the system shows the current month in a stable week grid with future dates inactive

#### Scenario: Browse an earlier month
- **WHEN** the user moves to a previous month
- **THEN** the system loads the exact bounded date range needed for that month in local, demo, or signed-in mode

#### Scenario: Sparse month
- **WHEN** a date has no food, water, fasting, or weight data
- **THEN** the date remains selectable and is presented neutrally as having no log

### Requirement: Selected-day history
The system SHALL show calories, carbs, protein, fibre, water, completed fasts,
and recorded weight for the selected calendar date.

#### Scenario: Select a logged date
- **WHEN** the user selects a date with history
- **THEN** the system shows that date's available totals and weight check-ins without changing stored data

#### Scenario: Select an empty date
- **WHEN** the user selects a past or current date without history
- **THEN** the system shows a clear no-log state without treating the date as a failure
