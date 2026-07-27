## MODIFIED Requirements

### Requirement: Device appearance preference
The system SHALL use Light when no valid device appearance preference has been
selected, SHALL offer System, Light, and Dark appearance choices, SHALL persist
an explicit choice on the device, and SHALL apply the resolved appearance
before the main interface paints.

#### Scenario: First visit
- **WHEN** the app opens without a valid stored appearance preference
- **THEN** the app renders the light token set

#### Scenario: System dark appearance
- **WHEN** System is selected and the device prefers a dark color scheme
- **THEN** the app renders the composed dark token set

#### Scenario: Explicit light appearance
- **WHEN** Light is selected on a dark-preferring device
- **THEN** the app renders the light token set on subsequent visits
