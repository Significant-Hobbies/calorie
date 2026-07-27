## MODIFIED Requirements

### Requirement: Water logging
The system SHALL log timestamped water amounts in millilitres, provide one-tap
presets for common amounts, and continue accepting water above the saved daily
target. The target SHALL be presented as a reference rather than a limit.

#### Scenario: Add a glass
- **WHEN** the user taps the 250 ml water preset
- **THEN** today's water total increases by 250 ml

#### Scenario: Exceed water target
- **WHEN** the user logs water after today’s total has met or exceeded the target
- **THEN** the controls remain available and the UI shows the actual total and percentage above 100%
