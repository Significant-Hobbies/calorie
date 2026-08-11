## MODIFIED Requirements

### Requirement: Mobile primary navigation
The system SHALL expose Today, Progress, Foods, and You as visible primary destinations on supported phone widths, with touch targets at least 44px and fixed-chrome spacing that respects the bottom safe area. Actionable nutrition insights SHALL remain reachable within Progress.

#### Scenario: Four-destination phone navigation
- **WHEN** the app renders on a 320px-or-wider phone viewport
- **THEN** each of the four destinations remains visible, reachable, and inside the fixed bottom navigation surface

#### Scenario: Fixed overlay clearance
- **WHEN** a toast, bottom sheet, or page end appears above the phone navigation
- **THEN** it remains visually and interactively clear of the bottom navigation and device home-indicator safe area
