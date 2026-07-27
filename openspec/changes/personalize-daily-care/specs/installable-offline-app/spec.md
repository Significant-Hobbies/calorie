## MODIFIED Requirements

### Requirement: Installable PWA
The system SHALL provide a valid web app manifest, install icons, standalone
display behavior, light and dark theme metadata, a registered service worker,
and an in-app install affordance when the browser exposes one.

#### Scenario: Installability check
- **WHEN** a supported browser evaluates the production build
- **THEN** it finds the manifest, required icons, active service worker, and matching theme metadata

#### Scenario: Browser install prompt
- **WHEN** the browser provides an install prompt and the app is not standalone
- **THEN** Settings offers an Install Calorie action that invokes that prompt

#### Scenario: Installed application
- **WHEN** Calorie is running in standalone display mode
- **THEN** Settings identifies the app as installed without offering another install action

### Requirement: Offline app shell and journal
The system SHALL open the cached app shell offline, show the complete
local-mode journal, and show the latest successfully cached cloud dashboard on
that device.

#### Scenario: Local-mode user reopens without network
- **WHEN** a local-mode user reopens the installed app offline
- **THEN** the app renders the complete local journal with an offline-only status cue

#### Scenario: Cloud user reopens without network
- **WHEN** a previously signed-in cloud user reopens the installed app offline
- **THEN** the app renders cached recent data with an offline-only status cue

### Requirement: Durable offline writes
The system SHALL queue food, water, medication, medication check-off, and
weight writes in IndexedDB with client-generated idempotency ids and retry them
when connectivity returns.

#### Scenario: Log water offline
- **WHEN** the user taps a water preset without network connectivity
- **THEN** the optimistic total updates and the write remains queued

#### Scenario: Check medication offline
- **WHEN** the user marks a medication taken without network connectivity
- **THEN** the optimistic checklist updates and the write remains queued

#### Scenario: Connection returns
- **WHEN** the device becomes online with queued writes
- **THEN** the app retries each write in order without creating duplicates
