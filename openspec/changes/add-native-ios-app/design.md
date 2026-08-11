## Context

See `proposal.md` for motivation and `specs/native-ios-client/spec.md` for the behavior contract. Calorie currently provides a local browser journal with an optional Google-authenticated D1 mode. The native client must remain useful without an account, preserve transparent calculations, and avoid medical or punitive framing. The owner selected Swift, simulator-first validation, personal Apple signing, and Apple-native tooling.

## Goals / Non-Goals

**Goals:**

- Build a maintainable SwiftUI iPhone app with a testable calculation and persistence core and no third-party runtime packages.
- Make food and daily-care logging immediately durable and fast with one hand.
- Reproduce current product behavior and semantic design while keeping account synchronization isolated.
- Produce a locally signed archive and complete metadata/privacy checklist without uploading it.

**Non-Goals:**

- Medical advice, medication dosage tracking, HealthKit integration, AI recommendations, social features, or a Fleet-wide hub.
- Replacing the web application or changing production database/auth behavior.
- Publishing, monetization, App Store Connect setup, or production service changes.

## Decisions

### Native Apple stack with a generated, checked-in Xcode project

The app uses SwiftUI, Charts, Observation, Foundation, URLSession, AuthenticationServices, UniformTypeIdentifiers, XCTest, and OSLog. A small `project.yml` generates a checked-in `.xcodeproj`; normal development and release work remain in Xcode. There are no third-party runtime packages.

### Versioned Codable journal behind an actor

Profile, foods, entries, water, routines, check-ins, weights, cycle context, preferences, and sync metadata live in a versioned Codable document written atomically in Application Support. This keeps local-only use simple, makes export exact, and provides deterministic tests. SwiftData was considered but rejected for the first native release because the existing product already treats the local journal as a portable document and does not require cross-process queries.

### Pure calculation functions

Energy targets, macro ranges, serving scaling, nutrient totals, and time estimates are pure functions with visible input/rule descriptions. Screens never invent guidance. This supports snapshot-like unit tests and ensures a no-estimate path remains valid.

### Optional account adapter using native browser authentication

`ASWebAuthenticationSession` connects to existing Better Auth routes and URLSession handles existing JSON contracts. Tokens or session material live only in Keychain. Local mutations append durable sync intents; the adapter reports pending, synced, conflict, and error states. No secret or service credential is embedded.

### Preserve-mode visual adaptation

The native app inherits `DESIGN.md`: a bright botanical pocket journal, moss primary actions, leaf ink, cherry calorie moments, amber carbohydrate/timing cues, rounded system typography, and Today/Progress/Foods/You navigation. SwiftUI semantic colors provide Light, Dark, and System palettes; native controls, Dynamic Type, VoiceOver, and Reduce Motion remain authoritative.

### Release boundary is local archive

Bundle identifier is `com.significanthobbies.calorie`; version starts at `1.0.0` build `1`; minimum deployment is iOS 17. The archive script defaults to personal team `8F7LXHTJZR`, writes outside source control, verifies its signature, and contains no upload step.

## Risks / Trade-offs

- [Nutrition contracts can drift between clients] → Centralize native DTOs, compare fixture outputs, and label source/provenance in calculations.
- [Offline and account histories can conflict] → Never silently discard a dirty local journal; show deterministic conflict choices and last-sync status.
- [Dense trend views can become inaccessible] → Pair every chart with a textual summary and test accessibility categories.
- [Simulator cannot validate camera-free real-device ergonomics, notifications, or Keychain/account callbacks fully] → Record them as device-only release checks.

## Migration Plan

1. Add the iOS project beside the web app with no service changes.
2. Implement and test local journal parity, calculations, import/export, and accessibility.
3. Validate account DTOs against non-mutating fixtures.
4. Capture simulator evidence and create a personal-team archive.
5. Stop before App Store Connect.

Removing `ios/` rolls back the change without affecting web users or server data.
