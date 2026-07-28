---
target: Progress meal timing insights
total_score: 36
max_score: 40
na_heuristics: ""
p0_count: 0
p1_count: 0
timestamp: 2026-07-28T16-05-21Z
slug: src-components-mealtiminginsights-tsx
---
# Meal timing insights critique

## Design specificity

**4/4 — recognizably Calorie.** The 24-hour rail, botanical palette, neutral
language, logged-day evidence, and fixed clock-band explanation form a product-
specific analysis rather than a generic dashboard card.

## Heuristic score

| Dimension | Score | Assessment |
| --- | ---: | --- |
| Hierarchy | 4/4 | The rail leads, facts support it, and the dominant calorie band provides a clear takeaway. |
| Composition | 4/4 | One coherent surface moves from timing to evidence without nested-card clutter. |
| Typography | 3/4 | Caption text now meets the 12 px floor; the mobile surface remains information-dense. |
| Color | 4/4 | Amber, moss, and plum are semantic in light and dark, and segmented controls remain low-glare. |
| Spacing | 3/4 | Dividers and spacing are consistent; the populated mobile card is necessarily long. |
| Interaction | 3/4 | Range controls are clear and touch-friendly; calculation details are not yet disclosed inline. |
| Responsive | 4/4 | The surface recomposes without overflow from 320 through 1440 px. |
| Accessibility | 4/4 | Labelled region, heading order, definition list, text legends, aria summaries, and 44 px controls are strong. |
| Density | 3/4 | The deterministic takeaway improves scanning, though all supporting evidence remains expanded. |
| Trust | 4/4 | Sample counts, missing-day handling, sleep assumptions, and the causality caveat are explicit. |
| **Total** | **36/40** | Clears the Fleet visual quality floor with no blockers. |

## Cognitive load and emotional journey

The surface has one analytical story: when eating begins and ends, followed by
supporting observations. Fixed time bands and visible denominators keep working-
memory demand low. The tone stays observational rather than punitive, and the
explicit sleep estimate avoids turning a neutral comparison into hidden health
advice.

## Strengths

- Timezone-aware first and last food times turn raw logs into a scannable rhythm.
- The repeated-food result now connects the food item to its usual logged time.
- Missing days are excluded, sample sizes stay visible, and sparse data does not
  produce a fake pattern.
- Light, dark, mobile, tablet, and desktop states retain the existing botanical
  language.

## Priority issues

- **P2 — Calculation detail is available in code but not in the interface.**
  A compact "How calculated" disclosure could explain that typical clock times
  use a circular mean and eating windows average first-to-last spans. This is an
  optional trust enhancement, not a release blocker.

## Persona red flags

- **Alex:** No blocking issue. A calculation disclosure would help an analytical
  user audit the methodology.
- **Sam:** The structure and non-colour labels are accessible; captions meet the
  documented minimum after the polish pass.
- **Casey:** Controls are thumb-friendly and the leading takeaway is visible
  without interpreting the chart, though the evidence card remains a long
  mobile read.

## Minor observations

- "Your eating rhythm" and the next card's "A gentle rhythm" repeat the same
  metaphor.
- Shading the rail between first and last food could make the eating interval
  even faster to scan, but requires careful cross-midnight handling.

## Questions

- Should a future iteration expose the methodology inline, or is the current
  plain-language evidence sufficient for the first release?
