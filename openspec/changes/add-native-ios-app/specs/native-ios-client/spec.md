## Purpose

Defines the observable behavior of Calorie's native iPhone client, including logging parity, local-first persistence, transparent guidance, account boundaries, accessibility, and submission preparation.

## ADDED Requirements

### Requirement: Native onboarding establishes transparent targets
The iOS client SHALL collect only the profile, goal, activity, optional equation-profile, medication-routine, and preference inputs needed by the existing product. It SHALL show how energy and macro targets are derived and SHALL support a no-estimate path.

#### Scenario: User declines an energy estimate
- **WHEN** the user chooses not to provide the inputs required by a published equation
- **THEN** the client allows manual targets and does not fabricate an estimate

### Requirement: One-handed daily logging has full food-entry behavior
The iOS client SHALL provide food search, recent and favorite foods, custom foods, amount and serving adjustment, meal assignment, timestamp editing, four core nutrients, edit, duplicate, and undoable deletion with a primary add action reachable on a phone.

#### Scenario: User logs a familiar food
- **WHEN** the user selects a recent food and confirms an amount
- **THEN** the entry appears in the selected meal with calories and macro values scaled to that amount

### Requirement: Daily care remains available offline
Food, water, medication routine check-ins, weight check-ins, notes, and preferences SHALL save locally without a network request and SHALL survive app relaunch.

#### Scenario: User logs while offline
- **WHEN** the network is unavailable and the user records food and water
- **THEN** the daily totals update immediately and the records remain after relaunch

### Requirement: Guidance is traceable and non-medical
Timing and daily guidance SHALL expose the inputs and rule used for training, fasting, sleep, medication-routine, calorie, and macro guidance. Copy SHALL avoid moral judgments and SHALL not present medication dosage, interaction, prescribing, or adherence advice.

#### Scenario: User opens a recommendation
- **WHEN** the user expands a timing recommendation
- **THEN** the client shows the relevant recorded inputs, the rule, and an estimate disclaimer

### Requirement: Progress and archives match the current product
The iOS client SHALL provide day and week history, calendar and time-grid review, nutrient and weight trends, goal-relative ranges, food analytics, cycle context where enabled, archived foods and routines, and data-control surfaces.

#### Scenario: User reviews a prior week
- **WHEN** the user selects a completed week in Progress
- **THEN** the client shows recorded totals and trends without punitive scoring or streak pressure

### Requirement: Optional account mode preserves a useful local journal
The iOS client SHALL be fully usable without an account. It SHALL support native Sign in with Apple using Apple's stable provider identifier, not an email address, and SHALL store session material only in Keychain. When an account is connected through existing Calorie contracts, the client SHALL expose synchronization state, durable pending writes, deterministic conflict behavior, sign out, export, and account deletion without silently discarding local records.

#### Scenario: Existing owner connects their current journal
- **WHEN** an owner chooses to connect existing Calorie data, proves control of the Google-authenticated account, and completes Sign in with Apple
- **THEN** the Apple provider identity is explicitly linked to that same Calorie user and the iOS client previews the existing D1 journal before merging or replacing local records

#### Scenario: Apple provides a private relay address
- **WHEN** Sign in with Apple returns a private relay address or omits email after the first authorization
- **THEN** Calorie identifies the account by Apple's verified stable subject and does not infer ownership from email equality

#### Scenario: Local and cloud journals both contain records
- **WHEN** an authenticated first sync finds records on both sides
- **THEN** the client shows counts and timestamps, offers keep-cloud, keep-iPhone, or deterministic ID-based merge, and performs no destructive reconciliation before explicit confirmation

#### Scenario: Offline write waits for sync
- **WHEN** an authenticated owner records supported journal data without connectivity
- **THEN** the local save completes immediately, a durable owner-scoped intent remains pending, and the client retries it after connectivity returns

#### Scenario: Fresh cloud state is requested repeatedly
- **WHEN** launch, foreground activation, or another caller requests the same connected journal while its cloud snapshot is fresh or already loading
- **THEN** the client reuses the fresh snapshot or awaits the in-flight request instead of issuing a duplicate export request

#### Scenario: A local mutation invalidates cloud state
- **WHEN** an authenticated owner changes supported journal data
- **THEN** the local journal updates immediately, the cloud snapshot becomes stale, pending intents are sent before one authoritative revalidation, and a failed request leaves the local change available for retry

#### Scenario: User signs out
- **WHEN** an authenticated user signs out
- **THEN** the client clears private cached server state, explains which local journal remains active, and does not claim unsynchronized cloud data is present locally

### Requirement: Theme and accessibility preferences are native
The iOS client SHALL support Light, Dark, and System appearance, Dynamic Type, VoiceOver labels and values, Reduce Motion, sufficient contrast, 44-point targets, and non-color status cues.

#### Scenario: User selects System appearance
- **WHEN** the device appearance changes
- **THEN** the botanical semantic colors retain their meanings in the corresponding native palette

### Requirement: Submission preparation stops before publication
The repository SHALL include privacy metadata, app icons, version/build configuration, support and privacy links or copy, automated tests, a simulator verification path, and a personal-team archive path. Preparation SHALL not create or modify App Store Connect records or upload a build.

#### Scenario: Maintainer prepares a release candidate
- **WHEN** the documented release checks and archive command complete
- **THEN** a locally verifiable archive and metadata checklist exist with publication left as a later manual action
