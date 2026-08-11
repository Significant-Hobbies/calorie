# Calorie Native Quality Audit

Audit target: iPhone simulator build of the native SwiftUI application in light and dark appearances.

## Score

| Category | Score | Notes |
| --- | ---: | --- |
| Accessibility | 3/4 | Dynamic Type reflows dense summaries, semantic labels accompany charts and controls, and contrast is stable in both appearances. Final VoiceOver traversal should be repeated on physical hardware. |
| Performance | 4/4 | Atomic local journal, bounded queries, native Charts, and no blocking startup or polling work. |
| Appearance | 4/4 | Cohesive botanical journal identity, adaptive semantic colors, restrained materials, and consistent hierarchy in Light, Dark, and System modes. |
| Platform conventions | 4/4 | SwiftUI tabs, sheets, menus, confirmations, forms, Charts, and native content-size behavior. |
| Adaptivity | 3/4 | Compact and accessibility layouts reflow cleanly across iPhone orientations, and the universal 13-inch iPad Release routes are store-ready. Physical iPad window resizing and keyboard behavior remain device checks. |

**Total: 18/20 — Excellent**

## Positive findings

- Light and dark themes retain the same calm visual hierarchy without hard-coded contrast failures.
- Quick Log keeps frequent food and water actions within one-handed reach while preserving editing depth.
- Nutrient charts include textual summaries, avoiding chart-only meaning.
- The journal makes calculated targets and guidance traceable and avoids presenting medical claims.

## Residual findings

- P0: 0
- P1: 0
- P2: 2 — physical-device VoiceOver pass; physical iPad window-resizing and keyboard pass.
- P3: 0

## Evidence

Screenshots are stored in `artifacts/simulator/`, including Dark and accessibility variants. Automated coverage and the Release simulator build are run by `./scripts/check.sh`; the personal-team archive is created by `./scripts/archive.sh` without upload.
