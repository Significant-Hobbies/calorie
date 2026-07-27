## Why

Calorie’s profile still expresses energy goals as one absolute adjustment even
though personal maintenance needs differ, and its daily-care surface stops at
food and water. The owner also wants a quieter app header, a composed dark
appearance, explicit installability, and private medication check-offs that
work like the rest of the local-first journal.

## What Changes

- Replace fixed calorie adjustments with maintenance-relative daily ranges:
  gradual loss at 80–85% of maintenance, faster loss at 75–80%,
  maintenance at 95–105%, and gradual gain at 105–110%.
- Keep the 1,200 kcal automatic floor, retain the goal-specific protein range,
  and let a manual profile override specify lower and upper calorie values.
- Preserve legacy single manual targets by interpreting them as the center of
  a ±100 kcal range until the profile is next saved.
- Add private medication definitions with Morning, Evening, or Either timing,
  plus one daily taken/not-taken check-off per active medication.
- Show medication tracking beside Water on Today and allow add, edit, and
  archive without exposing one user’s medicines to another.
- Persist medication data in local mode and authenticated D1 mode; queue cloud
  medication writes for retry when offline.
- Remove the Online/Offline badge beside the profile avatar.
- Add System, Light, and Dark appearance settings using the existing botanical
  visual language and semantic color tokens.
- Keep the existing PWA foundation, add an in-app install affordance when
  supported, align light/dark theme metadata, and verify the production build’s
  manifest, service worker, icons, and offline shell.
- Show zero-valued macro inputs as empty fields so typing does not create a
  leading zero.
- Treat the water goal as a reference rather than a cap: keep logging available
  above 100% and show the real total and percentage.

## Capabilities

### New Capabilities

- `medication-tracking`: Private medicine definitions, schedule labels, daily
  check-offs, archive behavior, and local/cloud persistence.
- `adaptive-app-shell`: Device-scoped appearance choice, composed dark theme,
  and the simplified profile header.

### Modified Capabilities

- `transparent-guidance`: Express automatic and manual calorie goals as ranges
  rather than one fixed goal adjustment.
- `private-account-setup`: Persist manual calorie ranges and medication data in
  local mode and scope cloud records to the authenticated user.
- `installable-offline-app`: Add install UI and include medication writes in
  local-first/offline behavior.
- `daily-intake-log`: Make explicit that water can be logged beyond the daily target.

## Impact

- Profile and dashboard TypeScript contracts, target calculations, onboarding,
  Settings, Today, Progress, local storage, and tests.
- New medication/check-off Worker routes and D1 migration; the migration file
  is authored but not applied.
- App-shell theme state, CSS semantic tokens, PWA metadata, and service worker.
- New OpenSpec capability files plus updates to existing durable specs and
  `PROJECT_STATUS.md`.
- No new production dependency, deployment, migration execution, notification,
  dosage advice, or medical recommendation.
