## Context

The app shell has five primary tabs but its mobile grid reserves four columns. Today is a dense single-column sequence in which the fastest food-logging actions compete with daily targets, water, medication, timing estimates, and the log. Insights already receives a bounded 7- or 30-day history payload including entries, but only aggregates per-food rankings. See `proposal.md` for motivation.

## Goals / Non-Goals

**Goals:**
- Keep all five primary destinations visible and reachable on phone screens, with safe fixed-surface spacing.
- Make Today’s first task rapid food logging while retaining every existing tracking capability.
- Derive insights entirely from the existing history/dashboard payloads, clearly label sparse data, and use neutral informational copy.
- Preserve the existing botanical visual system and its mobile-first, accessibility, and dark-mode constraints.

**Non-Goals:**
- New storage fields, Worker routes, migrations, external analytics, food recommendations from external sources, medical advice, or changes to the product’s tab labels/routes.
- Replacing Progress, changing target calculations, or adding a barcode scanner, food image recognition, or social features.

## Decisions

1. **Use a five-column navigation grid on phones rather than hiding a destination or introducing a new overflow menu.** This fixes the defect while preserving the existing information architecture. The alternative of a floating log action plus four tabs would hide an established primary destination and require additional interaction design.

2. **Use CSS custom properties for fixed chrome clearance.** The bottom-bar height, toast position, and main-content padding will share a navigation clearance value including `env(safe-area-inset-bottom)`. This prevents drift between independently positioned surfaces and keeps content reachable above the home indicator.

3. **Make Today’s summary factual and action-led.** The top sequence will lead with rapid logging and a compact “today’s targets” status that names the factors in view. Existing water, medication, timing, and detailed log surfaces remain available lower in the page rather than being removed. The alternative of a numeric daily score remains too opaque and invites moral interpretation.

4. **Compute Insights client-side from existing bounded history plus dashboard targets.** A pure helper will generate summary metrics, comparable prior-window deltas when enough history is returned, coverage against available targets, repeat/variety measures, data confidence, and a plain-language takeaway. This avoids a backend change and preserves local/demo/cloud parity. When a prior equal window is absent, the UI will state that comparison is unavailable instead of inferring one.

5. **Use logged days as the denominator for nutrition summaries and disclose it.** Empty calendar days are not evidence of zero intake. The UI will never treat unlogged days as failure or manufacture a trend from missing data.

## Risks / Trade-offs

- **A single 7/30-day request may not include a preceding equal comparison window** → Hide the comparison and make that absence explicit; do not fetch an unbounded history range or alter the API in this change.
- **More insight cards can recreate Today’s density problem** → Use a clear summary-first hierarchy, one takeaway, and progressive detail instead of adding parallel dashboard panels.
- **Changing daily-rating language can surprise existing users** → Retain the same underlying completion calculation where displayed, but translate it into explainable factor coverage.
- **Fixed surfaces vary by device/browser** → Verify at 320, 390, 768, and 1440px with safe-area-aware CSS and inspect overlays/sheets.

## Migration Plan

This is a client-only, backward-compatible rollout. Existing persisted journals, server responses, and routes remain unchanged. If the new Insights presentation regresses, the implementation can revert without transforming data.
