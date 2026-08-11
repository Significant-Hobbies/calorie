## 1. Mobile shell foundation

- [x] 1.1 Preserve the current four-destination bottom navigation and centralize safe-area-aware fixed-chrome clearance tokens.
- [x] 1.2 Update bottom-sheet, toast, and content-end spacing so fixed controls never obscure primary content.
- [x] 1.3 Verify the shell at 320px, 390px, 768px, and 1440px with touch-target and keyboard-focus coverage.
- [x] 1.4 Harden the food-entry sheet with contained focus, Escape dismissal, opener restoration, background inertness, and scroll locking.

## 2. Today hierarchy and feedback

- [x] 2.1 Recompose Today so recent-food logging is the leading task while retaining targets, water, medication, timing, and entry history.
- [x] 2.2 Replace evaluative daily-rating copy with transparent configured-target coverage and factor labels.
- [x] 2.3 Add or update focused tests for changed daily-feedback behavior.

## 3. Actionable insights

- [x] 3.1 Extend client-side history analytics to calculate logged-day confidence, food variety/repeat patterns, available target coverage, and an informational takeaway.
- [x] 3.2 Add unit tests for sparse history, target availability, coverage, repeat patterns, and neutral takeaway selection.
- [x] 3.3 Rebuild Insights within Progress around a summary, confidence context, coverage, patterns, and retained ranking details for 7- and 30-day windows.
- [x] 3.4 Load the immediately preceding equal bounded window, label comparisons accurately, expose the configured target basis near the takeaway, and collapse secondary charts behind progressive disclosure.

## 4. Save direct entries for reuse

- [x] 4.1 Keep the empty saved-food entry control actionable and allow a valid direct entry to become a reusable food without leaving the entry sheet.
- [x] 4.2 Add focused conversion tests and preserve one-off entry behavior.

## 5. Validation and closeout

- [x] 5.1 Run targeted tests and `pnpm check`, resolving failures without changing unrelated work.
- [x] 5.2 Run the Impeccable detector, critique, polish, and audit; capture browser evidence at 390px, 768px, and 1440px; resolve all P0/P1 findings.
- [x] 5.3 Update the design-review receipt, validate the OpenSpec change, and record delegated owner closeout feedback before archival.
