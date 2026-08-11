## Why

Calorie's core job is fast, one-handed daily logging, yet the maintained experience is web-only. A native iPhone client can make capture, daily guidance, medication context, and progress review faster and more dependable while preserving the product's private, local-first model.

## What Changes

- Add a first-party SwiftUI iPhone application using Apple frameworks and no new production dependencies.
- Match the current Calorie surface: onboarding, daily energy and macro targets, food search and custom foods, meal logging, editing, timing, medication and cycle context, progress and trends, archive, preferences, authentication, synchronization, export, and deletion controls.
- Preserve offline-first logging and deterministic reconciliation when an account is connected.
- Adapt the existing botanical pocket-journal visual system to native controls and accessibility conventions.
- Add native tests, privacy metadata, app metadata, icons, simulator verification, and a signed archive workflow that stops before upload.
- Keep the web application intact and do not add a unified Fleet hub.

## Capabilities

### New Capabilities

- `native-ios-client`: Native iPhone behavior, feature-parity requirements, local-first persistence, synchronization boundaries, accessibility, and submission preparation.

### Modified Capabilities

None.

## Impact

Adds an `ios/` Swift/Xcode surface beside the existing web application. Existing web routes, API behavior, data formats, dependencies, and production deployment remain unchanged. The iOS app uses the personal Apple development team for local signing and produces no App Store Connect records or uploads.
