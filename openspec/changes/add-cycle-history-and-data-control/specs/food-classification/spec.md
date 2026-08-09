## ADDED Requirements

### Requirement: Packaging context survives reusable and one-off logging
The system SHALL let the owner mark both saved foods and direct one-off food entries as Packaged or Not packaged and add optional normalized labels. Packaging and labels SHALL be private snapshots on journal entries so later food edits or deletion do not rewrite history.

#### Scenario: Saved food packaging
- **WHEN** the owner creates or edits a saved food
- **THEN** they can choose Packaged or Not packaged and optional comma-separated labels
- **AND** one-tap entries copy that context into the journal snapshot

#### Scenario: One-off classification
- **WHEN** the owner logs a direct entry without saving it
- **THEN** the same packaging and labels controls are available
- **AND** the entry retains them without creating a saved-food record

#### Scenario: Legacy food-kind migration
- **WHEN** an existing saved food or entry was explicitly classified as packaged food
- **THEN** it becomes Packaged
- **AND** every other legacy kind becomes Not packaged without changing its labels

### Requirement: Saved food ordering is predictable
The active food library SHALL expose a small, plainly named ordering set: recently used, name, protein, and fibre. Every order SHALL use name as a stable tie-breaker and SHALL keep icon/button alignment intact at mobile widths.

#### Scenario: Owner changes order
- **WHEN** the owner selects a saved-food ordering option
- **THEN** the visible list immediately follows that documented order
- **AND** foods with equal values are ordered by name
