## ADDED Requirements

### Requirement: Food-level analytics surface
The system SHALL provide a dedicated Insights tab that computes food-level
consumption patterns from the user's history entries over a selectable 7- or
30-day window, without exposing another user's data.

#### Scenario: Most-logged foods
- **WHEN** the user opens Insights with logged history
- **THEN** foods are ranked by number of logged occasions, grouped by saved food id or, for direct entries, by food name

#### Scenario: Biggest calorie contributors
- **WHEN** the user opens Insights with logged history
- **THEN** foods are ranked by total calories contributed across the window

#### Scenario: Per-occasion averages
- **WHEN** a food has multiple occasions in the window
- **THEN** Insights shows the average calories, carbs, protein, and fibre per occasion for that food

#### Scenario: Empty history
- **WHEN** the user has no entries in the selected window
- **THEN** Insights shows an empty state explaining that patterns appear after logging

#### Scenario: Window toggle
- **WHEN** the user switches between 7- and 30-day windows
- **THEN** all analytics recompute for the selected window

#### Scenario: Cross-user isolation
- **WHEN** analytics are computed
- **THEN** only the authenticated user's own history entries are used
