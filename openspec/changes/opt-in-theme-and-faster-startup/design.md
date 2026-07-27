## Context

The Vite entry bundle currently imports every authenticated tab plus the Better
Auth React client even though startup only needs Today and a session check. The
app also reads the session and profile in sequence. Theme preference is already
device-local, but absence of a preference currently resolves to System.

The app must remain mobile-first, keep Today immediately available, preserve
local/demo behavior, and avoid adding dependencies or changing stored user
data.

## Goals / Non-Goals

**Goals:**

- Make dark mode an explicit user choice by defaulting new devices to Light.
- Reduce initial JavaScript parsing by splitting secondary tabs.
- Remove one signed-in startup round trip by returning session and profile
  together.
- Keep offline/local fallbacks and accessible loading feedback.
- Quantify the built-asset change.

**Non-Goals:**

- Redesigning the existing light or dark palettes.
- Server rendering, dependency replacement, or database migrations.
- Deferring the Today tab, login, onboarding, or legal routes.
- Claiming field Core Web Vitals without production telemetry.

## Decisions

### Default to Light without writing an implicit preference

When the theme key is absent or invalid, the client resolves it to Light.
System and Dark remain explicit persisted choices. This keeps an unchosen
device preference distinct from a deliberate System choice and avoids a data
migration.

An alternative was to remove System entirely, but that would take away a
useful existing preference instead of making dark mode optional.

### Split only secondary authenticated tabs

Foods, Progress, and Settings load through React lazy imports, while Today and
all pre-authentication surfaces stay in the entry chunk. The existing skeleton
language provides an accessible Suspense fallback.

An alternative was to split every page. That risks adding latency to the
highest-frequency Today and sign-in paths for a smaller entry bundle.

### Add one private bootstrap read

The Worker exposes an authenticated `/api/app/bootstrap` read containing the
already-available session user and profile. The browser caches both shapes for
existing offline fallbacks. Local and demo modes compose the same response
client-side.

```mermaid
sequenceDiagram
    participant Browser
    participant Worker
    participant D1
    Browser->>Worker: GET /api/app/bootstrap
    Worker->>Worker: validate Better Auth session
    Worker->>D1: read profile
    D1-->>Worker: profile
    Worker-->>Browser: session user + profile
    Browser->>Browser: render Today; lazy-load other tabs on demand
```

An alternative was parallel calls to the existing session and profile
endpoints. That removes serial waiting but still spends an extra HTTP request
and duplicates authenticated middleware work.

### Use the existing auth server route for sign-out

The browser posts directly to the mounted Better Auth sign-out endpoint rather
than importing the full React auth client solely for one action. The server
dependency remains unchanged.

## Risks / Trade-offs

- **First opening of a secondary tab waits for its chunk** → Show the existing
  skeleton fallback and keep chunks scoped to one page.
- **Bootstrap duplicates session response shaping** → Keep it to the stable
  user fields already consumed by `AppShell`.
- **Cached offline data could be stale** → Preserve the existing cache policy
  and use it only when the cloud read is unavailable.
- **Direct sign-out could drift with auth routing** → Keep the mounted
  `/api/auth` base path and validate with the repo check/build.

## Migration Plan

Deploy the Worker and assets together; no data migration is required. Rollback
is the previous Worker version because the new GET route is additive and the
theme preference format is unchanged.

## Open Questions

None.
