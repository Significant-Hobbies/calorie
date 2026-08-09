---
target: Progress desktop weekly calendar
total_score: 32
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 0
timestamp: 2026-08-09T21-47-05Z
slug: src-components-historycalendar-tsx
---
## Design Health Score

| # | Heuristic | Score | Key issue |
|---|---|---:|---|
| 1 | Visibility of system status | 4 | Day totals and events now agree; loading, selection, filtering, and disabled future navigation are explicit. |
| 2 | Match system / real world | 3 | Journal language is natural; tracked nutrient density still needs its nearby explanatory note. |
| 3 | User control and freedom | 4 | All scoped views, filters, and period navigation are direct, reversible, and preserved across responsive changes. |
| 4 | Consistency and standards | 4 | Monthly mobile and weekly desktop views share the existing Calorie visual and interaction system. |
| 5 | Error prevention | 3 | Future navigation and dates are guarded; calendar-load failure recovery is still generic. |
| 6 | Recognition rather than recall | 3 | Full date labels, distinct signal shapes, legend, and roving date focus reduce memory demand. |
| 7 | Flexibility and efficiency | 3 | Desktop filters, week/month switching, and arrow-key date movement support repeat use. |
| 8 | Aesthetic and minimalist design | 3 | Calm hierarchy and restrained surfaces; early-week views necessarily devote space to upcoming days. |
| 9 | Error recovery | 2 | Errors are plain-language but do not offer a dedicated calendar retry action. |
| 10 | Help and documentation | 3 | Context-not-score and nutrient-density explanations are concise and nearby. |
| **Total** |  | **32/40** | **Good** |

## Design Specificity Verdict

The weekly journal is authored for Calorie rather than interchangeable dashboard UI. Its chronological food, weight, and medicine events, non-punitive empty-day language, botanical palette, and tracked protein/fibre density treatment fit the product's daily-use tone. The calendar shell is intentionally conventional so dates remain immediately legible.

The independent design assessment initially found three P1 issues: contradictory demo aggregates, unreadable dark-mode cycle context, and weak month-grid keyboard/signal semantics. All three were resolved before final evidence. The isolated deterministic scan returned zero findings for `HistoryCalendar.tsx`; no false positives required suppression.

## Overall Impression

The surface now feels like a practical food journal rather than a generic analytics calendar. The primary remaining compromise is spatial: a Monday-start current week contains six legitimate upcoming days, while populated past weeks use all seven columns efficiently.

## What's Working

- Desktop opens directly into a Monday-to-Sunday chronological journal, while 390px and 768px retain the established monthly scan and selected-day detail.
- All/Food/Weight/Medicine filters are visible, keyboard operable, and keep event time, name, and type recognizable without relying on color.
- Food-density labels are deterministic and dynamic, appear on saved foods and log entries, and explicitly state that they only compare tracked protein and fibre per 100 kcal.
- Dark mode, long names, populated weeks, empty/filter states, future days, and responsive transitions remain readable without horizontal overflow.

## Priority Issues

1. **[P2] Calendar load recovery remains generic.** A failed range request surfaces the shared inline error but no calendar-local Retry control. Add a focused retry if real usage shows transient history failures.
2. **[P3] Early-week desktop views contain large upcoming-day regions.** This is truthful Monday-to-Sunday behavior, but a later density pass could compress future columns without changing the requested calendar model.

## Persona Red Flags

- **Alex:** The repeated weekly workflow is fast and filterable, but the product does not persist the chosen filter across sessions.
- **Sam:** The month grid now has one tab stop plus Arrow/Home/End movement and visible focus. Calendar controls meet 44px, meanings are not color-only, and the concise status announcement avoids rereading the whole detail panel.
- **Riley:** Current-day aggregates now reconcile with entries, long populated weeks do not overflow, and resizing preserves the selected period. A deliberately failed history request still depends on the page-level error.

## Minor Observations

- The current-week view is naturally sparse early on Monday; previous-week navigation immediately exposes a fully populated comparison.
- “Medicine” follows the user's requested filter wording, while the saved-routine surface elsewhere uses “Medications.”
- Food-density badges wrap to two lines in narrow seven-column cells rather than clipping.

## Questions to Consider

- If transient history failures occur in active use, should Retry live inside the journal card or remain page-level?
- Should the selected All/Food/Weight/Medicine filter persist across visits, or should every visit start from the complete journal?

Questions skipped: the remaining findings are non-blocking and the approved implementation scope already determines the current behavior.
