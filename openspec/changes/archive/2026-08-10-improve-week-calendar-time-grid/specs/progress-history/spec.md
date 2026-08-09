## MODIFIED Requirements

### Requirement: Calendar history
The system SHALL provide a desktop-default weekly journal and a navigable month calendar using available nutrition, hydration, completed-fast, weight, timestamped food-entry, and medicine check-in data for each local date.

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
