## ADDED Requirements

### Requirement: Exercise timing does not present stale or trivial signals
The system SHALL only derive an exercise window from a food entry with at least 10 g carbohydrate whose computed broad window has not ended. It SHALL distinguish an upcoming window from one that is active now and SHALL explain when no qualifying recent signal exists.

#### Scenario: Window already passed
- **WHEN** all qualifying carb-entry windows ended before now
- **THEN** the product shows no current meal-based window
- **AND** it does not display past clock times as the next best window

#### Scenario: Window is active
- **WHEN** now falls inside a qualifying meal window
- **THEN** the summary says the window is active now
- **AND** retains the end time and source-entry explanation

### Requirement: Mobile navigation fully occludes underlying content
The bottom navigation SHALL meet the bottom and safe-area edge with an opaque product surface and SHALL reserve matching document clearance. No interactive or readable page content SHALL appear between or through the navigation and viewport edge.

#### Scenario: Mobile safe area
- **WHEN** the app is viewed on a narrow screen with or without a bottom safe-area inset
- **THEN** navigation owns the full lower chrome region
- **AND** the final page control remains reachable above it
