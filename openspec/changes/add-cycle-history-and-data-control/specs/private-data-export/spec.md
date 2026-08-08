## Purpose

Give the owner a complete private backup they can keep independently of the app, without adding an import path or exposing another journal.

## ADDED Requirements

### Requirement: Versioned complete journal export
The system SHALL download one versioned JSON document containing the current profile, reusable foods including archive state, food entries, water entries, medication routines and check-ins, weight check-ins, and cycle sessions.

#### Scenario: Export a local journal
- **WHEN** the owner chooses Download backup in local mode
- **THEN** the browser downloads a timestamped JSON file built from that browser's complete journal state

#### Scenario: Export an authenticated journal
- **WHEN** an authenticated owner chooses Download backup
- **THEN** the downloaded document contains only rows scoped to that authenticated user

#### Scenario: Export sparse data
- **WHEN** one or more journal collections are empty
- **THEN** the export still includes those collections as empty arrays plus its schema version and generation timestamp

### Requirement: Safe export boundary
The export MUST omit authentication tokens, provider identifiers, credentials, environment values, cache internals, and queued transport metadata.

#### Scenario: Inspect exported keys
- **WHEN** an export document is generated
- **THEN** it contains only the documented journal data contract and no secret or synchronization metadata

### Requirement: Recoverable export failure
The system SHALL keep the current journal unchanged and show a plain-language retry message when export generation or download fails.

#### Scenario: Cloud export request fails
- **WHEN** the authenticated export endpoint cannot return a complete document
- **THEN** no partial download is presented as a valid backup and the owner can retry
