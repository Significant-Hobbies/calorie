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

### Explicit Apple linking with a native session

`SignInWithAppleButton` obtains an Apple identity token and nonce through AuthenticationServices. Better Auth validates the token against Apple's public keys and the app bundle identifier; this native path does not require a Services ID or client-secret JWT. Browser-based Apple OAuth remains disabled unless those separate credentials are configured. The native client stores the returned bearer session only in Keychain. Apple email is display/contact metadata only; the stable provider subject owns the link.

An existing owner selects **Connect existing Calorie data** first. `ASWebAuthenticationSession` proves control of the existing Google-backed Calorie account. A Worker callback exchanges that browser session for a single-use, five-minute native handoff code, never puts a reusable session in a callback URL, and consumes the code exactly once. The authenticated native session then explicitly links the Apple token to that user. Better Auth implicit email linking stays disabled, including when Apple returns the same real email.

```mermaid
sequenceDiagram
    participant Phone as Calorie iPhone
    participant Apple as Sign in with Apple
    participant Auth as Better Auth Worker
    participant Google as Existing Google login
    participant D1 as Private D1 journal
    Phone->>Google: Prove existing account in ASWebAuthenticationSession
    Google->>Auth: Existing authenticated browser session
    Auth-->>Phone: One-use native handoff code
    Phone->>Auth: Exchange code; store bearer session in Keychain
    Phone->>Apple: Request native Apple credential
    Apple-->>Phone: Verified ID token + stable subject
    Phone->>Auth: Explicitly link Apple to authenticated user
    Auth->>D1: Read the same owner-scoped journal
    Auth-->>Phone: Reconciliation preview
```

### Local-first reconciliation and durable intents

The native adapter downloads the versioned cloud export and maps it into the native document without fabricating unavailable fields. The first reconciliation offers keep-cloud, keep-iPhone, or deterministic merge. Merge is ID-based for foods, entries, water, weights, routines, and check-ins; the most recently modified representation wins only where both contracts expose a reliable timestamp, while profile conflicts remain an explicit choice.

After connection, supported local mutations save first, append a durable sync intent, then attempt the existing owner-scoped REST contract. Successful writes remove their intent; offline, authentication, and server failures retain it and set a visible pending/failed state. Sign out removes the Keychain session but preserves the local journal and pending work. Account deletion requires confirmation and routes through Better Auth so the auth user and D1-owned rows cascade together.

### Preserve-mode visual adaptation

The native app inherits `DESIGN.md`: a bright botanical pocket journal, moss primary actions, leaf ink, cherry calorie moments, amber carbohydrate/timing cues, rounded system typography, and Today/Progress/Foods/You navigation. SwiftUI semantic colors provide Light, Dark, and System palettes; native controls, Dynamic Type, VoiceOver, and Reduce Motion remain authoritative.

### Release boundary is local archive

Bundle identifier is `com.significanthobbies.calorie`; version starts at `1.0.0` build `1`; minimum deployment is iOS 17. The archive script defaults to personal team `8F7LXHTJZR`, writes outside source control, verifies its signature, and contains no upload step.

## Risks / Trade-offs

- [Nutrition contracts can drift between clients] → Centralize native DTOs, compare fixture outputs, and label source/provenance in calculations.
- [Offline and account histories can conflict] → Never silently discard a dirty local journal; show deterministic conflict choices and last-sync status.
- [Apple email can be hidden, changed, or absent after first authorization] → Key identity to the verified Apple subject and require explicit proof before linking an existing Google journal.
- [A browser callback can leak a reusable credential] → Return only a short-lived one-use handoff code and store the resulting bearer session in Keychain.
- [Native and web journal shapes are not identical] → Preserve exact source records, map only supported fields, disclose local-only fields, and cover fixtures in both TypeScript and Swift tests.
- [Dense trend views can become inaccessible] → Pair every chart with a textual summary and test accessibility categories.
- [Simulator cannot validate camera-free real-device ergonomics, notifications, or Keychain/account callbacks fully] → Record them as device-only release checks.

## Migration Plan

1. Add the iOS project beside the web app with no service changes.
2. Implement and test local journal parity, calculations, import/export, and accessibility.
3. Add the optional Apple/Google linking contract and validate account DTOs against non-mutating fixtures.
4. Verify Keychain persistence, one-use handoff, reconciliation choices, offline intent retention, sign out, and deletion without touching production data.
5. Capture simulator evidence and create a personal-team archive.
6. Stop before App Store Connect and production credential/config changes.

Removing `ios/` rolls back the change without affecting web users or server data.
