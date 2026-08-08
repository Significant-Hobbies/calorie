## 1. Cycle-based goals

- [x] 1.1 Add tested helpers that map stored goal values to Cut, Gain, and Recomposition while preserving legacy behavior and Cut intensity.
- [x] 1.2 Recompose the Settings goal editor around the three cycle choices, immediate target preview, Cut intensity, manual-override clarity, and save behavior.
- [x] 1.3 Update onboarding to use the same cycle controls and personalized-plan language without adding a step.
- [x] 1.4 Add focused calculation, mapping, onboarding, and profile-normalization tests for cycle selection and manual ranges.

## 2. Reusable-food lifecycle

- [x] 2.1 Add nullable reusable-food archive state to shared types and normalize legacy local/demo data as active.
- [x] 2.2 Add a backward-compatible D1 migration file for food archive state without applying it.
- [x] 2.3 Implement lifecycle-filtered list, archive, restore, and permanent-delete behavior across local, demo, client API, Worker, offline/cache invalidation, and per-user query boundaries.
- [x] 2.4 Update every active food consumer so archived foods cannot appear in Today shortcuts, suggestions, or entry pickers while historical snapshots remain intact.
- [x] 2.5 Rebuild Foods with Active and Archived views, Archive and Restore actions, separately confirmed permanent deletion, and accessible empty/loading/error feedback.
- [x] 2.6 Add focused tests for active filtering, archive/restore parity, ownership-safe Worker queries, legacy normalization, and historical-entry preservation.

## 3. Daily action queue

- [x] 3.1 Add a pure, timezone-aware daily-action helper for weight, creatine, food, and water completion plus Creatine routine matching.
- [x] 3.2 Add Today’s responsive four-action “Up next” queue with incomplete-only rendering, completion announcements, reduced-motion behavior, and safe focus transfer.
- [x] 3.3 Connect weight to a compact check-in flow, food to the existing entry sheet, water to a clear one-tap amount, and creatine to its existing check-in or prefilled routine setup.
- [x] 3.4 Keep the standard food, water, and supplement controls available after top prompts disappear and restore prompts when an applicable entry/check-in is undone.
- [x] 3.5 Add focused helper and interaction tests for fresh, partial, all-complete, missing-creatine, undo, and timezone-boundary states.

## 4. Cycle analytics and mobile shell

- [x] 4.1 Extend the bounded Progress summary with active-cycle context, logged-day coverage, average fibre, and neutral signed weight change.
- [x] 4.2 Add focused analytics tests for logged-day denominators, sparse samples, preferred weight units, and first-to-last change.
- [x] 4.3 Repair the four-tab mobile bottom-bar grid and verify shared safe-area clearance for page content, sheets, and toasts.

## 5. Preserve-mode interface polish

- [x] 5.1 Create the preserve-mode design receipt and capture Today, Foods, Settings, and onboarding before evidence.
- [x] 5.2 Refine hierarchy, spacing, responsive grouping, interactive states, dark mode, and accessible labels across the changed surfaces using existing tokens and components.
- [x] 5.3 Run the Impeccable detector, critique, polish, and audit; resolve all P0/P1 findings and record advisory findings.
- [x] 5.4 Capture after screenshots at 390px, 768px, and 1440px and complete the design receipt with evidence and scores.

## 6. Validation and handoff

- [x] 6.1 Run the smallest relevant tests after each implementation group, then run `pnpm check` and `git diff --check`.
- [x] 6.2 Run strict OpenSpec validation and verify no migration, deploy, credential, production configuration, commit, or push occurred.
- [x] 6.3 Request owner keep/close feedback, record the decision, and validate the design workflow receipt before considering archival.
