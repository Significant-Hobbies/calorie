# progress-history Specification

## Purpose
Define seven- and thirty-day nutrition, hydration, eating-gap, weight, calendar
journal, and tracked nutrient-density history.
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
- **WHEN** the user requests a bounded calendar range
- **THEN** the system returns the daily totals and timestamped event detail required by the active calendar layout

### Requirement: Trend interpretation
The system SHALL describe trends with neutral language and SHALL NOT infer
medical outcomes from weight or nutrition history.

#### Scenario: Weight increases
- **WHEN** the plotted weight trend rises
- **THEN** the system reports the measured change without calling it good or bad

### Requirement: Calendar history
The system SHALL provide a desktop-default weekly journal and a navigable month
calendar using available nutrition, hydration, completed-fast, weight,
timestamped food-entry, and medicine check-in data for each local date.

#### Scenario: Open calendar on desktop
- **WHEN** the user opens Progress Calendar at a desktop width
- **THEN** the system shows the current Monday-to-Sunday week by default
- **AND** the week is presented as a scrollable 24-hour time grid with explicit hour labels
- **AND** food entries, weight check-ins, and medicine check-ins are rendered as calendar events at their recorded local times
- **AND** food events show the food name, local time, and calories without becoming a separate list beneath the day
- **AND** the default All filter interleaves food entries, weight check-ins, and actual medicine check-ins by local time

#### Scenario: Browse an earlier week
- **WHEN** the user moves to a previous week
- **THEN** the system loads the exact seven-day bounded range for that week in local, demo, or signed-in mode
- **AND** the visible date range and direction of navigation are explicit
- **AND** the same time-grid event placement remains visible

#### Scenario: Return to the current period
- **WHEN** the user is viewing an earlier week or month and chooses Today
- **THEN** the system returns to the current week or month
- **AND** selects the current local date where a selected date applies

#### Scenario: Return to a recently viewed period
- **WHEN** the user paginates back to a recently loaded week or month in the same session
- **THEN** the system shows the cached calendar range immediately without replacing the calendar with an initial-loading skeleton
- **AND** the system may refresh the range in the background so newly logged data can appear

#### Scenario: Account changes in the same browser session
- **WHEN** a different user opens Progress without a full browser reload
- **THEN** the system SHALL NOT show calendar, trend, dashboard, or cycle data cached for the previous user

#### Scenario: Filter weekly events
- **WHEN** the desktop user selects Food, Weight, or Medicine
- **THEN** the time grid shows only events of the selected type while keeping all seven dates and all 24 hours available
- **AND** selecting All restores the chronological mixed event view

#### Scenario: Events share a similar time
- **WHEN** two or more weekly events occur close enough that their visual blocks would overlap
- **THEN** the system keeps each event individually reachable without changing its displayed recorded time
- **AND** activating an event reveals its full name, time, and available log details outside the constrained event block

#### Scenario: Medicine history remains private
- **WHEN** an authenticated user requests a weekly range containing medicine check-ins
- **THEN** the system returns only that user's check-ins with the associated medicine name and recorded time

#### Scenario: Browse beyond the current week
- **WHEN** the displayed week is the current week
- **THEN** navigation to a later week is unavailable and future dates within the current week are inactive

#### Scenario: Switch desktop calendar to month
- **WHEN** the desktop user selects Month
- **THEN** the system shows the current month in the existing stable week grid with future dates inactive
- **AND** selecting a date continues to show the existing detailed day view

#### Scenario: Open calendar below desktop width
- **WHEN** the user opens Progress Calendar below the supported desktop breakpoint
- **THEN** the system keeps the existing month calendar and selected-day detail without presenting the weekly time-grid control

#### Scenario: Sparse week
- **WHEN** a weekly date has no food entries or other history
- **THEN** that day remains visible as an empty time-grid column without treating the lack of entries as a failure

#### Scenario: Browse an earlier month
- **WHEN** the user moves to a previous month
- **THEN** the system loads the exact bounded date range needed for that month in local, demo, or signed-in mode

#### Scenario: Sparse month
- **WHEN** a date has no food, water, fasting, or weight data
- **THEN** the date remains selectable and is presented neutrally as having no log

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

### Requirement: Tracked nutrient-density rating
The system SHALL compute a non-persisted nutrient-density rating from the
protein and fibre recorded per 100 kcal and SHALL present it as a limited signal
rather than a complete judgment of food quality.

The rating SHALL be `High` when protein is at least 8 g per 100 kcal, fibre is
at least 3 g per 100 kcal, or both protein is at least 4 g and fibre is at least
1.5 g per 100 kcal. It SHALL be `Medium` when protein is at least 4 g or fibre is
at least 1.5 g per 100 kcal, and `Low` otherwise. Packaging and carbohydrate
values SHALL NOT reduce the rating.

#### Scenario: Rate a saved food
- **WHEN** a saved food has positive calories and tracked protein and fibre values
- **THEN** the system shows its High, Medium, or Low tracked nutrient-density rating
- **AND** the exact protein and fibre values per 100 kcal are available as the explanation

#### Scenario: Rate an individual entry
- **WHEN** a saved-food or one-off entry is displayed in the weekly journal or daily log
- **THEN** the system computes the rating from that entry's nutrient snapshot rather than a mutable current saved-food record

#### Scenario: Calories are unavailable
- **WHEN** a food or entry has zero calories
- **THEN** the system presents the nutrient-density rating as unavailable instead of dividing by zero or implying low quality

#### Scenario: Explain the rating boundary
- **WHEN** the user reviews the rating explanation
- **THEN** the system states that the signal uses only tracked protein and fibre per calorie and does not assess vitamins, minerals, ingredients, or overall health quality
