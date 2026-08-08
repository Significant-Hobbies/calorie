## Why

Calorie is now used as a real daily journal, so changing the current goal is no longer enough: the owner needs to know when each Cut, Gain, or Recomposition phase began, whether that phase is producing a coherent signal, and how it compares with the previous phase. Daily use also makes correction, personalization, and an owned backup essential because inevitable typos or changing routines must not make the journal feel brittle.

## What Changes

- Record explicit private cycle sessions with editable start dates, closed end dates, goal/target snapshots, and one active session per journal.
- Treat a saved cycle switch as a transition that closes the active session and starts a new one without rewriting earlier history.
- Add cycle-focused Progress analytics: elapsed days, logged-day coverage, average calories and protein against the cycle plan, smoothed weekly weight rate, measured change, previous-cycle comparison, and a transparent neutral status.
- Let the owner enable, disable, and reorder the four Today prompts while keeping food, water, medication, and weight logging available in their normal surfaces.
- Add clear correction paths for water and weight check-ins; food entries and medication check-ins retain their existing edit/remove behavior.
- Add a downloadable, versioned private JSON backup containing the profile, reusable foods, journal entries, water, medication routines/check-ins, weight, and cycle sessions in local, demo, and authenticated cloud modes.
- Preserve legacy local and cloud journals by deriving default prompt preferences and lazily creating an active cycle session when none exists.
- Add a backward-compatible D1 migration but do not apply or deploy it as part of implementation.
- Harden meal-based exercise timing so weak or expired signals are never presented as the next window.
- Fine-tune the mobile shell and saved-food library: opaque safe-area navigation, simpler predictable sorting, aligned actions, and private food-kind/label snapshots on saved and one-off entries.

## Capabilities

### New Capabilities

- `goal-cycle-history`: Private cycle-session transitions, editable cycle dates, plan snapshots, and cycle-bounded interpretation.
- `daily-action-preferences`: Owner-controlled visibility and ordering for the four incomplete daily prompts without removing standard logging surfaces.
- `private-data-export`: A complete, versioned, user-scoped downloadable journal backup with no cross-user data exposure.
- `food-classification`: Food kind and optional labels shared by saved foods and one-off journal snapshots, plus predictable library ordering.
- `guidance-and-mobile-polish`: Non-stale exercise timing and safe mobile bottom chrome.

### Modified Capabilities

- `daily-intake-log`: Water check-ins become editable/removable from visible history.
- `progress-history`: Weight check-ins become editable/removable and Progress adds bounded cycle analytics, smoothed rate, status, and prior-cycle comparison.

## Impact

- Shared types, profile normalization, recommendation and analytics helpers, local/demo state versions, offline writes/cache behavior, client API adapters, Worker routes, and per-user D1 queries change.
- Today, Progress, and Settings gain new multi-state controls while preserving the current botanical design system and mobile-first logging speed.
- A new D1 migration adds cycle-session storage plus daily-prompt preference fields; existing migration `0003_food_archiving.sql` remains unapplied.
- No new production dependency, credential, deployment, remote migration, medical inference, or destructive import path is introduced.
