## ADDED Requirements

### Requirement: Device appearance preference
The system SHALL offer System, Light, and Dark appearance choices, persist the
choice on the device, and apply it before the main interface paints.

#### Scenario: System dark appearance
- **WHEN** System is selected and the device prefers a dark color scheme
- **THEN** the app renders the composed dark token set

#### Scenario: Explicit light appearance
- **WHEN** Light is selected on a dark-preferring device
- **THEN** the app renders the light token set on subsequent visits

### Requirement: Composed botanical dark mode
The dark appearance SHALL preserve the botanical brand roles, provide distinct
canvas and elevated surfaces, and meet WCAG AA contrast and visible-focus
requirements without mechanically inverting the light theme.

#### Scenario: Dark Today dashboard
- **WHEN** the Today dashboard is viewed in Dark appearance
- **THEN** text, inputs, navigation, nutrient states, dialogs, and focus indicators remain legible

### Requirement: Quiet connection chrome
The system SHALL omit a persistent Online badge near the profile control and
SHALL show connection status only when offline action or recovery is relevant.

#### Scenario: Online app shell
- **WHEN** the browser is online
- **THEN** the header shows the profile control without an Online label

#### Scenario: Offline app shell
- **WHEN** the browser is offline
- **THEN** an offline-only cue explains that local use continues and cloud writes will retry
