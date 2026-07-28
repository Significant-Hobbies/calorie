# progress-history Specification

## Purpose
Define seven- and thirty-day nutrition, hydration, eating-gap, and weight
history.
## Requirements
### Requirement: Weight check-ins
The system SHALL store timestamped weight check-ins and show progress toward the
saved target without moral labels.

#### Scenario: New weight
- **WHEN** the user records a valid weight
- **THEN** the system updates the trend and preserves earlier check-ins

### Requirement: Historical statistics
The system SHALL provide bounded 7-day and 30-day statistics for calories,
carbs, protein, fibre, water, completed fasts, weight, and the timestamped food
entry detail required for meal-timing analysis.

#### Scenario: Seven-day view
- **WHEN** the user selects the seven-day range
- **THEN** the system shows daily values, range averages, comparison to targets, and timing insights from that bounded range

#### Scenario: Sparse history
- **WHEN** fewer than two days contain entries
- **THEN** the system shows the available daily data and a helpful meal-timing empty-state prompt

#### Scenario: Calendar history
- **WHEN** the user requests a calendar range without selecting Trends
- **THEN** the system may omit entry-level detail that the calendar does not display

### Requirement: Trend interpretation
The system SHALL describe trends with neutral language and SHALL NOT infer
medical outcomes from weight or nutrition history.

#### Scenario: Weight increases
- **WHEN** the plotted weight trend rises
- **THEN** the system reports the measured change without calling it good or bad

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
