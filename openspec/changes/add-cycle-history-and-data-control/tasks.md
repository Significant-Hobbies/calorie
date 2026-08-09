## 1. Contracts and pure domain logic

- [x] 1.1 Extend shared profile and journal types with normalized daily-action preferences, cycle sessions, cycle-history responses, and the versioned export contract.
- [x] 1.2 Add focused daily-action preference normalization tests for legacy, reordered, hidden, duplicate, and unknown keys.
- [x] 1.3 Implement tested cycle-session transition, date-boundary, plan-snapshot, and legacy-seeding helpers.
- [x] 1.4 Implement tested cycle analytics for elapsed days, logged-day denominators, plan deltas, measured change, least-squares weekly rate, transparent status, sparse samples, and prior-cycle comparison.
- [x] 1.5 Implement tested export sanitization and stable versioned serialization without transport/auth/cache metadata.

## 2. Durable local, demo, and D1 storage

- [x] 2.1 Bump and normalize local durable state for preferences and cycle sessions without changing existing journal records.
- [x] 2.2 Add equivalent demo-state cycle, preference, correction, analytics, and export behavior.
- [x] 2.3 Add `0004_cycle_history_and_data_control.sql` with additive profile preference fields, private cycle-session storage, ownership/date indexes, and no migration application.

## 3. Client API, offline, and Worker parity

- [x] 3.1 Extend profile save/bootstrap boundaries so preferences persist and top-level cycle changes atomically close/start sessions while intensity-only changes update the active snapshot.
- [x] 3.2 Add active-cycle date editing and exact active/previous cycle-history reads across local, demo, API, and user-scoped Worker routes.
- [x] 3.3 Add water PATCH plus weight PATCH/DELETE parity with optimistic/offline cache invalidation and per-user Worker mutations.
- [x] 3.4 Add complete sanitized journal export parity for local, demo, and authenticated Worker modes using user-scoped reads only.
- [x] 3.5 Add focused Worker/source tests for ownership clauses, cycle transition invariants, export table coverage, and forbidden export fields.

## 4. Settings control surfaces

- [x] 4.1 Add a preserve-mode design receipt update and before evidence for Cycle history, Daily prompts, Data backup, and correction surfaces.
- [x] 4.2 Extend Goal & daily range with the active cycle start date, validation feedback, and a compact prior-cycle history disclosure.
- [x] 4.3 Add accessible Show/Hide and Move Up/Down controls for all four daily prompts with immediate preview and saved order.
- [x] 4.4 Add a Data backup row that downloads the complete timestamped JSON document and exposes loading, success, and retry states.
- [x] 4.5 Add Settings tests or pure view-model tests for prompt controls, start-date validation, and export filenames.

## 5. Today corrections and personalization

- [x] 5.1 Render incomplete daily actions from the saved enabled set and stable owner-defined order while preserving the standard logging panels.
- [x] 5.2 Show today's individual water check-ins with accessible edit/remove controls, amount/time validation, optimistic totals, undo-compatible prompt restoration, and empty state.
- [x] 5.3 Add focused tests for hidden/reordered prompt derivation and water correction totals.

## 6. Progress corrections and cycle analytics

- [x] 6.1 Add a cycle overview ahead of lower-level Trends with active dates, elapsed days, status explanation, logged-day coverage, calories/protein versus plan, weight change/rate, and sparse states.
- [x] 6.2 Add a neutral previous-cycle comparison that appears only for supported matching samples.
- [x] 6.3 Add visible weight history with edit/remove confirmation, preferred-unit conversion, and immediate recalculation of charts and cycle analytics.
- [x] 6.4 Add focused component/view-model tests for cycle overview states, comparison eligibility, and weight correction conversions.

## 7. Polish, validation, and handoff

- [x] 7.0a Add food-kind and label snapshots across saved foods, direct entries, local/demo/D1 storage, API validation, export, and both logging editors.
- [x] 7.0b Replace technical saved-food sorting with predictable recent, name, protein, and fibre orders; align add/action icons at mobile widths.
- [x] 7.0c Harden exercise guidance against trivial and expired carb signals with upcoming/active copy and focused tests.
- [x] 7.0d Make the bottom navigation an opaque edge-to-edge safe-area surface with matching content clearance.

- [x] 7.1 Inspect Today, Progress, and Settings at 390px, 768px, and 1440px plus dark mode; verify 200% zoom, keyboard order, focus transfer, 44px controls, and safe-area clearance.
- [x] 7.2 Run one Impeccable detector pass, independent critique, polish, and audit; resolve all P0/P1 findings and record advisory findings.
- [x] 7.3 Capture after screenshots at 390px, 768px, and 1440px and complete the design receipt with passing scores and evidence.
- [x] 7.4 Run targeted tests during each group, then `pnpm check`, `git diff --check`, and strict OpenSpec validation.
- [x] 7.5 Verify no migration, deployment, credential, production configuration, commit, push, or dependency change occurred; request final owner keep/close feedback before archival.

## 8. Owner clarification follow-up

- [x] 8.1 Replace the four-value food-kind contract with a tested binary `isPackaged` property across shared types, local/demo normalization, saved foods, and entry snapshots.
- [x] 8.2 Add unapplied migration `0005_food_packaging.sql` with deterministic legacy backfill and authenticated Worker/API/export parity.
- [x] 8.3 Replace food-kind controls with Packaged/Not packaged controls in saved-food create/edit and every direct one-off logging path.
- [x] 8.4 Hide the entire Today daily-action surface when no incomplete prompt remains; remove explanatory mechanics copy and the aggregate “targets in view” status.
- [x] 8.5 Correct shared Progress graph/annotation spacing, then run the requested code-level audit and one Impeccable detector pass.
- [x] 8.6 Run focused tests, `pnpm check`, `git diff --check`, and strict OpenSpec validation; do not migrate, deploy, commit, or push without new approval.

## 9. Progress audit remediation

- [x] 9.1 Preserve the local calendar date when opening an existing weight check-in for editing, with an early-morning regression test.
- [x] 9.2 Add captioned, screen-reader-only data tables containing every plotted value for all Progress charts.
- [x] 9.3 Raise metric-filter touch targets to 44 CSS pixels and replace the one-sided accent border with the existing quiet surface treatment.
- [x] 9.4 Correct singular count and unset-range copy, and restore valid ordered-list children for food rankings.
- [x] 9.5 Run the focused test, full repo check, Impeccable detector, strict OpenSpec validation, and `git diff --check` without deploying.
