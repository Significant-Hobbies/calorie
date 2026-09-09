# Owner install receipt — 9 September 2026

Exact source: `15c6aa1e050fdb123778cd8ab71ce4e0dae20d12`.
[CI 34335890509](https://github.com/Significant-Hobbies/calorie/actions/runs/34335890509)
passed both jobs: 82 native tests (30 core, 41 app, 11 UI), Release build,
and 5,785/8,199 covered production lines (70.5574%).

The existing XcodeBuildMCP device build produced a signed Release in 17.3 s,
using Xcode 26.6 with provisioning updates off. Signature verification passed;
bundle `com.significanthobbies.calorie`, team `8F7LXHTJZR`, version 1.0.0,
build 14. Build number is reused for this local update; source and hashes
identify the artifact precisely.

- CDHash: `505ca12e1fa5ab240c0397c4b4d9be43d231f41b`
- Executable SHA-256: `f5204e7c42edda037d338ff3aa71dd88fe3869656c753ae58e823a21f4c740b8`
- Canonical manifest SHA-256, without final newline: `5d4b4b201c36910576c491faa8c4fe6dd3137e10225e95e379121305d5ad2558`
- Manifest file SHA-256, including newline: `3e37f0141b208c46991b3ae1e97da0d33488986ea433ba1f8d8d09273e00d2c3`

All retained artifact file hashes match. An initial manifest recheck compared
the newline-terminated file against its canonical JSON hash; the difference
was serialization only, with every app file unchanged.

After exact CI passed, the device list showed the owner iPhone available.
The first XcodeBuildMCP `device install` attempt succeeded. This was an
install-only same-bundle update: no uninstall, reset, launch, account sync,
recovery, credential change or owner-record operation. Availability did not
prove unlock state; no launch was used to test it.

The signed app, manifest and machine-readable receipt remain locally in
`.artifacts/owner-ready-15c6aa1/`. Task derived build data was cleaned through
XcodeBuildMCP after copying the artifact. No test app remains running.

This installs the verified simulator logging/edit/delete/undo, persistence,
no-target and scroll-clipping repairs. It does not qualify physical logging,
physical relaunch persistence, real-account isolation/sync, TestFlight public
access or App Store distribution. Those remain in [issue 88](https://github.com/Significant-Hobbies/calorie/issues/88).

## Subsequent documentation CI failure and test repair

Documentation-only descendant `164b7e6` failed native CI
[34337638142](https://github.com/Significant-Hobbies/calorie/actions/runs/34337638142):
`testDailyAndEntryScoresExposeTheirCalculationBasis` could not find the
“This amount” button after a globally matched food-label tap. Ten other UI
tests passed, including persistence and edit/delete/undo. No hosted result
artifacts were available; the failed log is retained locally as
`.artifacts/owner-ready-15c6aa1/docs-ci-failure.log`.

An isolated local run retaining the original selection/assertions passed in
25.9 seconds. Its hierarchy showed both underlying Today and picker food
labels, plus the score below the viewport (y 879.4 on a 874-point screen).
Thus the old test could pass without verifying a visible score. This does
not establish which of selection or offscreen accessibility caused the hosted
failure; no app navigation failure was reproduced.

The test now selects the actual picker button, verifies “Add entry,” scrolls
the selection view, and requires the score to be hittable. Existing daily
basis and tracked-score assertions remain intact. Screenshots and hierarchy
are retained for future diagnosis. The changed focused test passed in 18.4 s;
`pnpm check` passed all 87 tests and existing gates. No app source changed and
no second phone install occurred.

Local evidence: `.artifacts/native-score-20260909/before/` and `after/`.
The final visible score screenshot is
`after/A42F9DA3-7CEB-44F6-A4E4-8FEE26F0FC55.png`.
The test terminates its isolated app; derived build data is cleaned through
XcodeBuildMCP. The installed source's green CI and successful install remain
separate receipts from this subsequent test-only repair.
