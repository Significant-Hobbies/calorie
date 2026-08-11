## Context

The current app shell intentionally has four primary destinations: Today, Progress, Foods, and You. An earlier implementation briefly added a standalone Insights tab, but the later product direction merged those analytics into Progress. Today is a dense single-column sequence in which the fastest food-logging actions compete with daily targets, water, medication, timing estimates, and the log. Progress receives bounded 7- or 30-day history payloads including entries and now owns both charts and actionable food-history interpretation. See `proposal.md` for motivation.

## Goals / Non-Goals

**Goals:**
- Keep all four current primary destinations visible and reachable on phone screens, with safe fixed-surface spacing.
- Make Today’s first task rapid food logging while retaining every existing tracking capability.
- Derive insights entirely from the existing history/dashboard payloads, clearly label sparse data, and use neutral informational copy.
- Preserve the existing botanical visual system and its mobile-first, accessibility, and dark-mode constraints.

**Non-Goals:**
- New storage fields, Worker routes, migrations, external analytics, food recommendations from external sources, medical advice, or changes to the product’s tab labels/routes.
- Replacing Progress, changing target calculations, or adding a barcode scanner, food image recognition, or social features.

## Decisions

1. **Preserve the four-destination navigation model on phones.** Today, Progress, Foods, and You remain visible in a four-column grid. Actionable food analytics live within Progress, so no destination is hidden behind overflow and the intentionally simplified information architecture stays intact.

2. **Use CSS custom properties for fixed chrome clearance.** The bottom-bar height, toast position, and main-content padding will share a navigation clearance value including `env(safe-area-inset-bottom)`. This prevents drift between independently positioned surfaces and keeps content reachable above the home indicator.

3. **Make Today’s summary factual and action-led.** The top sequence will lead with rapid logging and a compact “today’s targets” status that names the factors in view. Existing water, medication, timing, and detailed log surfaces remain available lower in the page rather than being removed. The alternative of a numeric daily score remains too opaque and invites moral interpretation.

4. **Compute Insights inside Progress from existing bounded history plus dashboard targets.** A pure helper generates summary metrics, comparable prior-window deltas, coverage against available targets, repeat/variety measures, data confidence, and a plain-language takeaway. The client requests the immediately preceding equal window through the existing bounded calendar-history path, avoiding a backend change and preserving local/demo/cloud parity. When that prior window has no recorded food, the UI states that comparison is unavailable instead of inferring one.

5. **Use logged days as the denominator for nutrition summaries and disclose it.** Empty calendar days are not evidence of zero intake. The UI will never treat unlogged days as failure or manufacture a trend from missing data.

## Risks / Trade-offs

- **A selected 7/30-day request does not include the preceding equal window** → Fetch exactly one preceding bounded window through the existing calendar-history path and make missing prior records explicit.
- **More insight cards can recreate Today’s density problem** → Use a clear summary-first hierarchy, one takeaway, and collapsed secondary charts instead of adding parallel expanded dashboard panels.
- **Changing daily-rating language can surprise existing users** → Retain the same underlying completion calculation where displayed, but translate it into explainable factor coverage.
- **Fixed surfaces vary by device/browser** → Verify at 320, 390, 768, and 1440px with safe-area-aware CSS and inspect overlays/sheets.

## Migration Plan

This is a client-only, backward-compatible rollout. Existing persisted journals, server responses, and routes remain unchanged. If the actionable Progress presentation regresses, the implementation can revert without transforming data.
