# Isolated native journal qualification — 9 September 2026

Baseline source: `90a23b5653979dc43f28ef79fe940ad11f2154dc`.
Scope: source-only singular-entry copy repair and one rendered UI regression.
No physical-device installation, owner journal, account, credentials, provider
configuration or production service was used or changed.

## Isolation and actual journey

XcodeBuildMCP 2.7.0 built and launched the app on iOS 26.5 simulator
`28E413D9-B587-41D3-9D7C-3D903BC6F842` without opening Simulator.app.
An invocation-only `PRODUCT_BUNDLE_IDENTIFIER` override resolved to
`com.significanthobbies.calorie.audit.Calorie`; the project configuration was
unchanged. `CalorieStore` uses this app container's Application Support path.
`--fresh-demo` loads sample records and returns before account restoration or
sync. It resets those samples on launch, so this is not relaunch persistence
or signed-in acceptance evidence.

The existing quick-log test chooses Greek yoghurt bowl and adds it to Snack.
The new `testEntryEditDeleteUndoUpdatesVisibleDailyTotals` opens the existing
row context menu, edits one serving to two, saves, deletes, and uses Undo.
It checks daily recorded energy at 515, 925, 105, and 925 kcal respectively.
Retained screenshots show remaining energy at 1,585, 1,175, 1,995, and 1,175
against the fixture's 2,100 target. The single remaining banana now displays
`1 entry`; restoring the yoghurt displays `2 entries`. The test dismisses the
existing successful-Undo confirmation before the final screenshot and
terminates its app in teardown.

Direct headless AXe input reported successful delivery but did not navigate
the app. XCTest completed the actual interactions; no application failure was
inferred from that input-tool limitation.

## Checks and evidence

- Focused native edit/delete/undo test passed before the copy repair, exposing
  the visible `1 entries` defect in its retained screenshot.
- Final native checks: 2 focused XCTest UI tests passed, zero failures/skips
  (54.7 seconds). Result bundle:
  `~/Library/Developer/XcodeBuildMCP/workspaces/fleet-167b0b9d8f42/result-bundles/test_sim_2026-09-09T09-02-04-809Z_pid67492_58303cb4.xcresult`.
- `pnpm check` on Node 24.20.0: passed, 87 server tests, zero critical/high
  dependency advisories, formatting/lint/types/build and maintenance checks.
- Local screenshots and XCTest attachment manifest are retained under ignored
  `.artifacts/native-journal-20260909/`; no synthetic fixture screenshots are
  presented as owner-phone evidence.

## Remaining acceptance

[Issue 88](https://github.com/Significant-Hobbies/calorie/issues/88) remains open.
The owner phone still has build 14/source `6ecaf4f`; this copy repair was not
installed or released. Physical logging and water entry, actual relaunch
persistence, approved account isolation/sync, and processed App Store Connect
build/audience remain independent gates. This test does not change the
internal-only distribution or establish shareability.
