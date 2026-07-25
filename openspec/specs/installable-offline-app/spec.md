# installable-offline-app Specification

## Purpose
Define installation, account-free local persistence, and offline behavior for
the finished web application.
## Requirements
### Requirement: Installable PWA
The system SHALL provide a valid web app manifest, install icons, standalone
display behavior, theme metadata, and a registered service worker.

#### Scenario: Installability check
- **WHEN** a supported browser evaluates the production build
- **THEN** it finds the manifest, required icons, and active service worker

### Requirement: Offline app shell and journal
The system SHALL open the cached app shell offline, show the complete
local-mode journal, and show the latest successfully cached cloud dashboard on
that device.

#### Scenario: Local-mode user reopens without network
- **WHEN** a local-mode user reopens the installed app offline
- **THEN** the app renders the complete local journal with a clear offline status

#### Scenario: Cloud user reopens without network
- **WHEN** a previously signed-in cloud user reopens the installed app offline
- **THEN** the app renders cached recent data with a clear offline status

### Requirement: Durable offline writes
The system SHALL queue food, water, and weight writes in IndexedDB with
client-generated idempotency ids and retry them when connectivity returns.

#### Scenario: Log water offline
- **WHEN** the user taps a water preset without network connectivity
- **THEN** the optimistic total updates and the write remains queued

#### Scenario: Connection returns
- **WHEN** the device becomes online with queued writes
- **THEN** the app retries each write without creating duplicates

### Requirement: Private cache lifecycle
The system SHALL keep auth routes network-only and SHALL clear cached private
data and pending writes on sign-out.

#### Scenario: Sign out
- **WHEN** the user signs out on a device
- **THEN** the service worker and IndexedDB no longer expose that user's cached data
