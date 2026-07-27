## MODIFIED Requirements

### Requirement: No-account local journal
The system SHALL let a user complete onboarding and use the full journal
without authentication, and SHALL persist that journal in browser storage.

#### Scenario: Start without an account
- **WHEN** a visitor chooses Start on this device
- **THEN** the app opens onboarding without contacting an authentication provider

#### Scenario: Reopen the local journal
- **WHEN** a local-mode user closes and later reopens the app in the same browser
- **THEN** their profile, foods, entries, water, medication definitions,
  medication check-offs, weight, and history remain available

### Requirement: Optional Google-authenticated private account
The system SHALL offer a working Google-authenticated cloud mode in production,
request only basic identity scopes, and scope all cloud profile, medication,
and event data to the authenticated user.

#### Scenario: Start production Google sign-in
- **WHEN** a visitor chooses Continue with Google on the production origin
- **THEN** the system redirects through the configured Google OAuth web client
  using the exact Better Auth callback URI

#### Scenario: Complete production Google sign-in
- **WHEN** Google returns a valid authorization response
- **THEN** the system creates or resumes the user session and opens that user’s
  private Calorie profile

#### Scenario: Unauthenticated API request
- **WHEN** a request without a valid session accesses a private API route
- **THEN** the system returns an unauthorized response without account data

#### Scenario: Authenticated data access
- **WHEN** a signed-in user requests profile, medication, or event data
- **THEN** the system returns only rows owned by that user's id

### Requirement: Editable assumptions
The system SHALL let users review and edit every consequential onboarding input,
including target weight, and override the calculated daily calorie range.

#### Scenario: Activity changes
- **WHEN** the user changes activity level in settings
- **THEN** future targets are recalculated and the new maintenance and goal
  range inputs are shown

#### Scenario: Target weight changes
- **WHEN** the user edits target weight in settings
- **THEN** Progress and goal summaries use the new destination

#### Scenario: Legacy manual target
- **WHEN** an existing profile contains one manual calorie target and no manual bounds
- **THEN** the app presents a range 100 kcal below and above that target until the profile is saved
