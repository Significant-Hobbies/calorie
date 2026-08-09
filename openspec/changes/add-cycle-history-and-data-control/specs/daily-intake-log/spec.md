## ADDED Requirements

### Requirement: Daily summary stays factual
The Today summary SHALL show the nutrient totals and configured range without an aggregate target-completion label.

#### Scenario: Open Today with configured targets
- **WHEN** the owner views the daily summary
- **THEN** it does not show “targets in view” or an equivalent count-based status

### Requirement: Visible water correction history
The system SHALL show today's individual water check-ins with amount and local time and SHALL let the owner edit or remove any of their own check-ins without changing unrelated entries.

#### Scenario: Correct a water amount
- **WHEN** the owner changes a 250 ml check-in to 350 ml
- **THEN** today's water total and percentage update by the 100 ml difference and the corrected timestamped entry remains in history

#### Scenario: Remove a water check-in
- **WHEN** the owner confirms removal of an incorrect water check-in
- **THEN** that entry no longer contributes to today's total and an applicable incomplete water prompt returns if no other water entry exists that day

#### Scenario: Cross-user water correction
- **WHEN** an authenticated user attempts to update or delete a water entry owned by another user
- **THEN** the system performs no mutation and returns no entry data
