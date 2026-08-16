---
target: Tracked quality scores across web and native food journals
total_score: 35
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 0
timestamp: 2026-08-15T22-45-29Z
slug: src-pages-todaypage-tsx
---
Method: dual-agent (A: score_design_assessment · B: score_mechanical_assessment)

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|---|---:|---|
| 1 | Visibility of system status | 4 | Provisional/final labels and score provenance are explicit. |
| 2 | Match system / real world | 3 | “Tracked” needs its adjacent explanation for first-time users. |
| 3 | User control and freedom | 4 | Calculation details are optional disclosures on both platforms. |
| 4 | Consistency and standards | 4 | Today, History, web, and native share the same concepts. |
| 5 | Error prevention | 4 | Missing, archived, one-off, and incompatible entries fall back without rewriting history. |
| 6 | Recognition rather than recall | 3 | Provenance is visible, though compact macro abbreviations remain nearby. |
| 7 | Flexibility and efficiency | 3 | Compact scores scan quickly and expand only when needed. |
| 8 | Aesthetic and minimalist design | 3 | The exact formula is necessarily dense when expanded. |
| 9 | Error recovery | 3 | Missing targets produce an unavailable state rather than an invented score. |
| 10 | Help and documentation | 4 | Factors, weights, targets, fallbacks, and caveats are inspectable. |
| **Total** |  | **35/40** | **Strong, product-specific score presentation.** |

## Design Specificity Verdict

The score surfaces are authored for Calorie: botanical styling stays restrained, the language avoids “good” and “bad” food judgments, and every number exposes the exact tracked inputs. The deterministic scan returned no findings across the six changed TSX targets.

## Overall Impression

The new hierarchy is clear: a target-based day score is visually distinct from the protein/fibre density score on individual foods, while provenance explains why old entries can change.

## What’s Working

- “Score so far” and “Final score” prevent a partial day from looking complete.
- “Latest active food” and “Logged values fallback” make historical recalculation understandable.
- The shared caveat and factor disclosure keep the score inspectable rather than opaque.

## Priority Issues

No unresolved P0/P1 issues remain. The pass fixed the weekly calendar’s 8px score text, added the score and provenance to parent button names, and expanded the calculation disclosure to a 44px touch target with readable mobile measure.

## Persona Red Flags

- A first-time user may still need the disclosure to understand “tracked”; the caveat is available directly beside the score.
- A screen-reader user receives score and provenance in the Today and weekly event button names.
- A one-handed mobile user can open the calculation disclosure with a full-size target and no horizontal overflow.

## Minor Observations

- Nearby C/P/F macro shorthand remains denser than the score language but predates this score presentation.
- Physical VoiceOver and iPad checks remain owner-side release checks.

## Questions to Consider

- Does the owner prefer the current numeric prominence after using it for several days?
- Should the expanded formula eventually use a shorter first sentence followed by the same exact details?
