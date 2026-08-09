## MODIFIED Requirements

### Requirement: Calendar history
The system SHALL provide a desktop-default weekly journal and a navigable month calendar using available nutrition, hydration, completed-fast, weight, timestamped food-entry, and medicine check-in data for each local date.

#### Scenario: Open calendar on desktop
- **WHEN** the user opens Progress Calendar at a desktop width
- **THEN** the system shows the current Monday-to-Sunday week by default
- **AND** each day shows its chronological food names and local eating times without requiring the user to select that day first
- **AND** the default All filter interleaves food entries, weight check-ins, and actual medicine check-ins by local time

#### Scenario: Browse an earlier week
- **WHEN** the user moves to a previous week
- **THEN** the system loads the exact seven-day bounded range for that week in local, demo, or signed-in mode
- **AND** the same day-level food and time detail remains visible

#### Scenario: Filter weekly events
- **WHEN** the desktop user selects Food, Weight, or Medicine
- **THEN** each day shows only events of the selected type while keeping all seven dates visible
- **AND** selecting All restores the chronological mixed event view

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
- **THEN** the system keeps the existing month calendar and selected-day detail without presenting the weekly journal control

#### Scenario: Sparse week
- **WHEN** a weekly date has no food entries or other history
- **THEN** that day remains visible and is presented neutrally as having no log

#### Scenario: Browse an earlier month
- **WHEN** the user moves to a previous month
- **THEN** the system loads the exact bounded date range needed for that month in local, demo, or signed-in mode

## ADDED Requirements

### Requirement: Tracked nutrient-density rating
The system SHALL compute a non-persisted nutrient-density rating from the protein and fibre recorded per 100 kcal and SHALL present it as a limited signal rather than a complete judgment of food quality.

The rating SHALL be `High` when protein is at least 8 g per 100 kcal, fibre is at least 3 g per 100 kcal, or both protein is at least 4 g and fibre is at least 1.5 g per 100 kcal. It SHALL be `Medium` when protein is at least 4 g or fibre is at least 1.5 g per 100 kcal, and `Low` otherwise. Packaging and carbohydrate values SHALL NOT reduce the rating.

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
