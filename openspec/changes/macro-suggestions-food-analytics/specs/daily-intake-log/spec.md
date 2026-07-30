## MODIFIED Requirements

### Requirement: One-tap recent logging
The system SHALL show recent foods ordered by last-used time with their default
amount and SHALL log that amount from one primary tap with immediate Undo. The
favourite flag SHALL NOT be exposed, rendered, or used for ordering in the UI.

#### Scenario: Quick-add food
- **WHEN** the user taps a recent food shortcut
- **THEN** the entry appears immediately with the current time and default amount

#### Scenario: Undo quick-add
- **WHEN** the user chooses Undo after a quick add
- **THEN** the system removes or cancels that specific entry

#### Scenario: Quick-pick ordering
- **WHEN** the user opens Today
- **THEN** quick picks are ordered by last-used time descending, independent of any stored favourite flag

## ADDED Requirements

### Requirement: Remaining-macro completion suggestions
The system SHALL show, on Today, the remaining calories, protein, and fibre
against the day's target and SHALL suggest the saved foods that best close the
largest remaining macro deficit. Suggestions are informational estimates from
the user's own saved foods, not medical advice.

#### Scenario: Calorie deficit
- **WHEN** the user has remaining calories and a calorie target is set
- **THEN** Today shows the remaining kcal and names saved foods whose default serving best covers the gap

#### Scenario: All macros met
- **WHEN** every tracked macro has been met or exceeded for the day
- **THEN** the remaining panel shows a complete state and no food suggestions

#### Scenario: No target set
- **WHEN** no calorie target is available for the profile
- **THEN** the remaining panel is hidden

#### Scenario: No saved foods
- **WHEN** macros remain but the user has no saved foods
- **THEN** the panel shows the remaining totals without food suggestions

### Requirement: Inferred daily rating
The system SHALL show an inferred 1–5 daily rating on Today and in calendar
day detail, computed from the average completion share of calorie, protein,
fibre, and water targets. The rating SHALL NOT be a manual score, SHALL NOT
be stored, and SHALL NOT appear when no targets are set.

#### Scenario: Fully completed day
- **WHEN** every tracked target is met or exceeded
- **THEN** the rating is 5 with an "Excellent day" label

#### Scenario: Empty day
- **WHEN** nothing has been logged but targets are set
- **THEN** the rating is 1 with a "Just beginning" label

#### Scenario: No targets set
- **WHEN** the profile has no calorie, protein, fibre, or water target
- **THEN** no rating is shown

#### Scenario: Calendar day detail
- **WHEN** the user selects a logged day in the calendar
- **THEN** the day detail shows the inferred rating from that day's totals against the current target
