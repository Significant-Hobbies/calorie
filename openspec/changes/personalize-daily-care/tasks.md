## 1. Profile Ranges and Intake Inputs

- [x] 1.1 Replace absolute goal adjustments with maintenance-relative calorie ranges and range-aware target types
- [x] 1.2 Add backward-compatible manual calorie range persistence for local and cloud profiles
- [x] 1.3 Update onboarding, Settings, Today, Progress, and tests to explain and consume ranges
- [x] 1.4 Keep zero macro fields visually empty and allow water logging beyond the displayed target

## 2. Medication Data

- [x] 2.1 Add medication and daily check-off types plus local-storage migration and operations
- [x] 2.2 Add the backward-compatible D1 migration and user-scoped Worker routes without applying the migration
- [x] 2.3 Add cloud API/offline-queue operations and dashboard hydration for medications and check-offs
- [x] 2.4 Add focused tests for validation, user-scoped contracts, and daily toggle behavior

## 3. Daily Medication Experience

- [x] 3.1 Add the Today medication section beside Water with optimistic daily check-offs
- [x] 3.2 Add accessible create/edit/archive medication controls for Morning, Evening, and Either
- [x] 3.3 Verify empty, loading, error, offline, and completed states at mobile and desktop widths

## 4. Appearance and PWA

- [x] 4.1 Add persisted System/Light/Dark theme state and composed semantic dark tokens
- [x] 4.2 Remove the permanent connection badge and add an offline-only recovery cue
- [x] 4.3 Add install-state UI and harden manifest, theme metadata, and service-worker caching
- [x] 4.4 Verify manifest, icons, service worker, standalone state, and offline shell locally

## 5. Validation and Documentation

- [x] 5.1 Run focused tests, typecheck, strict OpenSpec validation, and the full project check
- [x] 5.2 Capture after screenshots at 390, 768, and 1440 pixels and complete critique, polish, audit, and detector checks
- [x] 5.3 Sync the main specs, update DESIGN.md and PROJECT_STATUS.md, record the
  design-review receipt, and leave archive as an explicit follow-up choice
