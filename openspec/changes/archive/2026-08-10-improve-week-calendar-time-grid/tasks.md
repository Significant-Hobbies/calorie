## 1. Calendar layout model

- [x] 1.1 Add pure helpers for 24-hour time labels, minute positioning, useful initial scroll, and overlapping-event lanes
- [x] 1.2 Cover event positioning and collision behavior with focused unit tests
- [x] 1.3 Add a bounded session range cache that serves revisited weeks and months immediately while refreshing in the background

## 2. Desktop weekly experience

- [x] 2.1 Replace weekly day lists with the semantic seven-day 24-hour event grid
- [x] 2.2 Render food, weight, and medicine records as accessible positioned events with existing filters and an inspectable detail state
- [x] 2.3 Add Previous, Today, and Next period navigation with explicit labels and current-period states

## 3. Visual and responsive polish

- [x] 3.1 Add sticky grid headers, time rulers, event states, dark mode, and dense-content handling within the existing design system
- [x] 3.2 Preserve the existing month calendar below the desktop breakpoint and verify 390px, 768px, and 1440px layouts

## 4. Validation

- [x] 4.1 Run the focused tests and full `pnpm check`
- [x] 4.2 Run OpenSpec validation, Impeccable detector/critique/polish/audit, and complete the design receipt evidence
