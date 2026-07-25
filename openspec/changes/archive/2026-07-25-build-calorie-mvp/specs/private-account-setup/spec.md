## ADDED Requirements

### Requirement: No-account local journal
The system SHALL let a user complete onboarding and use the full journal
without authentication, and SHALL persist that journal in browser storage.

#### Scenario: Start without an account
- **WHEN** a visitor chooses Start on this device
- **THEN** the app opens onboarding without contacting an authentication provider

#### Scenario: Reopen the local journal
- **WHEN** a local-mode user closes and later reopens the app in the same browser
- **THEN** their profile, foods, entries, water, weight, and history remain available

### Requirement: Optional Google-authenticated private account
The system SHALL offer Google as an optional cloud-backed mode and SHALL scope
all cloud profile and event data to the authenticated user.

#### Scenario: Unauthenticated API request
- **WHEN** a request without a valid session accesses a private API route
- **THEN** the system returns an unauthorized response without account data

#### Scenario: Authenticated data access
- **WHEN** a signed-in user requests profile or event data
- **THEN** the system returns only rows owned by that user's id

### Requirement: Guided onboarding
The system SHALL collect name, units, age, height, current weight, optional
gender identity, energy-equation profile, activity, goal, target weight, pace,
wake time, sleep need, and fasting threshold across a short mobile flow.

#### Scenario: User completes onboarding
- **WHEN** the user supplies valid required inputs and confirms the summary
- **THEN** the system saves the profile, records the initial weight, and opens Today

#### Scenario: User skips energy equation
- **WHEN** the user chooses not to select a sex-based energy equation profile
- **THEN** the system completes onboarding without an automatic calorie estimate

### Requirement: Editable assumptions
The system SHALL let users review and edit every onboarding input and override
the calculated daily calorie target.

#### Scenario: Activity changes
- **WHEN** the user changes activity level in settings
- **THEN** future targets are recalculated and the new inputs are shown
