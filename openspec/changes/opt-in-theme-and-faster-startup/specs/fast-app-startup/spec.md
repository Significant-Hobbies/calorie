## ADDED Requirements

### Requirement: Critical startup code
The browser app SHALL include the initial account flow and Today surface in its
entry path and SHALL defer secondary authenticated tabs until they are opened.

#### Scenario: Open Today after signing in
- **WHEN** an authenticated user opens Calorie on the Today tab
- **THEN** Foods, Progress, and Settings page code is not required before Today can render

#### Scenario: Open a deferred tab
- **WHEN** a user opens a secondary tab before its code has loaded
- **THEN** the app presents an accessible loading state until that tab is ready

### Requirement: Consolidated account bootstrap
The cloud-backed app SHALL retrieve the authenticated session user and profile
through one private startup read while preserving local, demo, and offline
fallback behavior.

#### Scenario: Signed-in cloud startup
- **WHEN** a valid cloud session opens the app
- **THEN** one app bootstrap response supplies the session user and profile

#### Scenario: Expired cloud session
- **WHEN** the bootstrap request is unauthorized
- **THEN** the app presents the signed-out experience

#### Scenario: Offline startup with cached private data
- **WHEN** the cloud read is unavailable and the device has valid cached session and profile data
- **THEN** the app can continue using the existing offline fallback
