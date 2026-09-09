# Local persistence and no-target display — 9 September 2026

Baseline: `c1ef9d4f38daa7b993a4df042c3abf6ec951a925` (exact CI
34332653952 passed both quality jobs, 81 native tests, Release and 70.3092%
production coverage). This follow-up is source and isolated simulator work;
the owner phone's build 14 remains unchanged.

## Actual defect and repair

Onboarding promises that choosing **No targets for now** will not invent a
target. The first real persistence screenshot exposed a contrary Today view:
210 recorded kcal appeared as 1,890 remaining against an implicit 2,100 budget,
with fabricated macro comparisons. `TodayView` now retains the absence of a
target. That state shows **Energy recorded**, recorded calories with **kcal
recorded**, and recorded nutrient amounts in grams. It omits remaining energy,
target comparisons and the progress capsule. A real configured target keeps
the existing remaining/progress/comparison view. The neutral caption does not
claim absence of separate goal-cycle range settings.

## Isolated persistence fixture

The approved [issue 88 spec](https://github.com/Significant-Hobbies/calorie/issues/88#issuecomment-5599320052)
adds `--persistent-ui-fixture <UUID>` only in DEBUG. Strict UUID validation
and incompatible-demo rejection happen before any ordinary account client
construction. Journal and outbox use existing real file-backed stores under
`Application Support/CalorieUITestJournals/<UUID>/`; onboarding uses a matching
UUID preferences suite. The injected client restores no account and rejects
identity and cloud operations. Existing malformed journals are not reseeded:
they follow the ordinary read-error recovery path.

The test creates a one-off **Persisted lentil bowl** through real onboarding
(210 kcal, 7 g protein, 28 g carbs, 5 g fibre), adds 250 ml water, terminates
and relaunches the process with the same UUID, then checks the retained entry
and totals. A second UUID has fresh onboarding and an empty food/water
journal (0 entries, 0 recorded kcal, 0 ml). Both UUIDs are removed by scoped
cleanup launches in teardown, including their preferences; cleanup does not
load a journal or restore/refresh an account. The test app has a separate
invocation-only audit bundle ID and never uses owner data or a physical device.

## Evidence

The first persistence run passed in 65.7 seconds and retained six screenshots
under ignored `.artifacts/native-persistence-20260909/`; it exposed the
no-target presentation defect while confirming persistence. Its Release build
passed in 14 seconds. The three fixture markers (`--persistent-ui-fixture`,
`PersistentJournalFixture`, `FixtureNoAccountClient`) were present in Debug
and absent from the compiled Release app.

The first corrected-UI pair passed the configured-target control and all
first-journal persistence/no-target checks, then failed a test-only assumption:
the second UUID bypasses onboarding and retains the ordinary starter profile's
manual target. Its zero-intake assertion was corrected to the exact existing
`kcal remaining · 0 recorded` caption. The first UUID's explicit-no-target
assertions were unchanged; video/screenshot evidence is retained under
`first-no-target/`.

The corrected persistence test passed in 58.5 seconds with six final screenshots
under `.artifacts/native-persistence-20260909/final/` and result bundle
`~/Library/Developer/XcodeBuildMCP/workspaces/fleet-167b0b9d8f42/result-bundles/test_sim_2026-09-09T09-27-52-551Z_pid27512_e700b162.xcresult`.
Post-test inspection found zero UUID fixture directories and no nonempty
fixture preferences (three empty suite files remain, with no test data).
`pnpm check` passed all 87 server tests and required maintenance/build gates.
The final configured-target edit/delete/undo control passed in 39.8 seconds,
with five screenshots under `final-control/` and result bundle
`~/Library/Developer/XcodeBuildMCP/workspaces/fleet-167b0b9d8f42/result-bundles/test_sim_2026-09-09T09-29-32-899Z_pid32195_99b9d0b5.xcresult`.
The final unsigned Release build passed in 10.2 seconds. Binary inspection
again found all three fixture markers in Debug and none in Release; the
receipt is `.artifacts/native-persistence-20260909/release-exclusion.json`.

## Remaining boundaries

Local synthetic persistence does not establish physical-device protection,
real-account isolation/sync, processed App Store Connect builds, an external
TestFlight audience, or public distribution. [Issue 88](https://github.com/Significant-Hobbies/calorie/issues/88)
remains open. No model/provider calls, credentials, dependencies, remote
configuration, migrations, device writes or release operations occurred.

A separate visual finding remains: scrolled food text can appear behind the
status-bar clock. This is retained as a layout follow-up; it was not mixed
into the target-correctness repair.
