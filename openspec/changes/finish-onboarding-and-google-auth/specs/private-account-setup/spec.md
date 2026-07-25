## MODIFIED Requirements

### Requirement: Optional Google-authenticated private account
The system SHALL offer a working Google-authenticated cloud mode in production,
request only basic identity scopes, and scope all cloud profile and event data
to the authenticated user.

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
- **WHEN** a signed-in user requests profile or event data
- **THEN** the system returns only rows owned by that user's id

### Requirement: Guided onboarding
The system SHALL use no more than three mobile steps, ask only for values with a
visible product consequence, preserve prior answers, and show the personalized
plan before completion.

#### Scenario: User changes goal
- **WHEN** the user selects a different weight goal
- **THEN** onboarding immediately shows the selected calorie adjustment and
  updated daily range

#### Scenario: User returns to an incomplete flow
- **WHEN** an onboarding user navigates backward or reloads the application
- **THEN** all valid answers and the current step are restored

#### Scenario: User completes onboarding
- **WHEN** the user supplies valid required inputs and confirms the plan
- **THEN** the system saves the profile, records the initial weight, clears the
  draft, and opens Today

#### Scenario: User skips energy equation
- **WHEN** the user chooses not to select a sex-based energy equation profile
- **THEN** the system completes onboarding without an automatic calorie
  estimate and explains which goal outputs are unavailable

#### Scenario: Unused personal field
- **WHEN** the onboarding flow is shown
- **THEN** it does not ask for gender identity because no product behavior uses
  that answer

### Requirement: Editable assumptions
The system SHALL let users review and edit every consequential onboarding input,
including target weight, and override the calculated daily calorie target.

#### Scenario: Activity changes
- **WHEN** the user changes activity level in settings
- **THEN** future targets are recalculated and the new maintenance and goal
  inputs are shown

#### Scenario: Target weight changes
- **WHEN** the user edits target weight in settings
- **THEN** Progress and goal summaries use the new destination

## ADDED Requirements

### Requirement: Answer-purpose disclosure
The system SHALL state the purpose of every onboarding answer at the point it is
requested or in the personalized review.

#### Scenario: Review answer usage
- **WHEN** the user reaches the final onboarding step
- **THEN** the system identifies which answers control calories, protein,
  fibre, progress, hydration, fasting, sleep, display units, and greetings
