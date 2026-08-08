## Why

Calorie’s current goal language does not match the Cut, Gain, and Recomposition cycles the owner actually uses, while Today gives recurring daily basics the same visual weight as lower-priority analysis. Reusable foods can only be permanently deleted, so temporarily irrelevant foods clutter logging shortcuts or require destructive cleanup.

## What Changes

- Add Cut, Gain, and Recomposition as the three top-level cycle choices, preserving transparent maintenance-relative calorie math and offering the existing gentle/steady intensity choice within Cut.
- Reframe onboarding and Settings around the active cycle so changing cycle immediately previews and saves the corresponding calorie and protein guidance.
- Add a compact “Up next” queue at the top of Today with four prominent actions: weight check-in, creatine, food, and water.
- Remove each top prompt once its task is completed for the local day while keeping the normal food, water, weight, and supplement controls available for further logging or correction.
- Reuse the private medication-routine model for creatine: an existing Creatine routine can be checked in from the queue, while a missing routine opens setup prefilled with “Creatine.”
- Archive reusable foods without deleting their historical entry snapshots, exclude archived foods from logging shortcuts and suggestions, and provide an Archived view with Restore plus separately confirmed permanent deletion.
- Apply a preserve-mode visual polish to Today, Foods, Settings, and onboarding using the existing botanical tokens, clearer hierarchy, compact state transitions, and accessible mobile-first controls.
- Repair the four-tab mobile bottom bar and add cycle-aware Progress summary analytics for fibre, weight change, and logged-day coverage using existing bounded history.

## Capabilities

### New Capabilities

- `cycle-based-goals`: Select an active Cut, Gain, or Recomposition cycle, derive transparent nutrition guidance, and interpret bounded progress in that cycle context.

### Modified Capabilities

- `daily-intake-log`: Prioritize incomplete daily logging actions and add reversible reusable-food archiving without changing historical entries.
- `private-account-setup`: Present cycle choice consistently during onboarding and expose it as an editable assumption afterward.

## Impact

- Client types, target calculations, onboarding/settings controls, Today orchestration, Foods library states, Progress summaries, mobile navigation, local/demo storage adapters, API helpers, Worker validation and queries, and focused tests.
- A backward-compatible D1 migration adds reusable-food archive state; applying that migration and deploying remain explicitly out of scope for this change.
- No new production dependency, authentication scope, external service, medical claim, or change to per-user data isolation.
