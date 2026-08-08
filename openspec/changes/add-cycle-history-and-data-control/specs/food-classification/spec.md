## ADDED Requirements

### Requirement: Food context survives reusable and one-off logging
The system SHALL let the owner classify both saved foods and direct one-off food entries with one food kind and optional normalized labels. Food kind SHALL be one of whole food, prepared meal, packaged food, or supplement. Labels SHALL be private snapshots on journal entries so later food edits or deletion do not rewrite history.

#### Scenario: Saved food classification
- **WHEN** the owner creates or edits a saved food
- **THEN** they can choose a food kind and optional comma-separated labels
- **AND** one-tap entries copy that context into the journal snapshot

#### Scenario: One-off classification
- **WHEN** the owner logs a direct entry without saving it
- **THEN** the same food-kind and labels controls are available
- **AND** the entry retains them without creating a saved-food record

### Requirement: Saved food ordering is predictable
The active food library SHALL expose a small, plainly named ordering set: recently used, name, protein, and fibre. Every order SHALL use name as a stable tie-breaker and SHALL keep icon/button alignment intact at mobile widths.

#### Scenario: Owner changes order
- **WHEN** the owner selects a saved-food ordering option
- **THEN** the visible list immediately follows that documented order
- **AND** foods with equal values are ordered by name
