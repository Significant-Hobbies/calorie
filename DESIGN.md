# Calorie Design System

## Direction

**Scene:** Someone stands in a bright kitchen after lunch, phone in one hand,
and logs a familiar bowl before getting back to their day.

Calorie uses a restrained product palette on a pure white background. The
identity comes from moss-green actions, deep leaf ink, small cherry and amber
food moments, and a compact seed-and-leaf mark. The generated references are:

- `docs/design/calorie-palette.png`
- `docs/design/calorie-mobile-north-star.png`

The references set hierarchy, density, and tone. Core interface text and
controls remain semantic HTML rather than raster assets.

## Color

All authored colors use OKLCH.

```css
:root {
  --color-bg: oklch(1 0 0);
  --color-surface: oklch(0.97 0.02 130);
  --color-surface-strong: oklch(0.935 0.034 130);
  --color-ink: oklch(0.18 0.005 130);
  --color-ink-soft: oklch(0.43 0.025 130);
  --color-line: oklch(0.88 0.025 130);
  --color-primary: oklch(0.55 0.142 130);
  --color-primary-strong: oklch(0.39 0.11 130);
  --color-on-primary: oklch(1 0 0);
  --color-cherry: oklch(0.63 0.215 25);
  --color-amber: oklch(0.74 0.15 85);
  --color-info: oklch(0.55 0.12 240);
  --color-error: oklch(0.55 0.2 25);
}
```

Primary green marks primary actions, current selection, progress, and positive
status. Cherry identifies calories or an attention moment. Amber identifies
carbs, fibre, and energy timing. Neither accent is decorative filler.

## Typography

Use one fast, native humanist stack:

```css
font-family:
  ui-rounded, "SF Pro Rounded", "Avenir Next", -apple-system,
  BlinkMacSystemFont, "Segoe UI", sans-serif;
```

The app uses a fixed rem scale:

- Display: 2rem / 1.1 / 750
- Heading: 1.5rem / 1.2 / 720
- Subheading: 1.125rem / 1.3 / 680
- Body: 1rem / 1.5 / 450
- Secondary: 0.875rem / 1.4 / 500
- Caption: 0.75rem / 1.35 / 620

Numbers use tabular figures. Labels and buttons stay in the same family.

## Layout

- Mobile-first single column, useful from 320px.
- Content width: 42rem on phones/tablets; desktop may use a 68rem
  dashboard split with the day log beside recommendations.
- Base rhythm: 4px; primary spacing steps are 8, 12, 16, 24, 32, and 48px.
- Controls are at least 44px high and remain reachable above phone safe areas.
- Bottom navigation is reserved for Today, Progress, Foods, and You.
- Cards top out at 16px radius. Prefer section spacing and dividers over
  wrapping every group in a card. Never nest cards.

## Components

- Buttons: 12px radius; filled moss for the single primary action, quiet
  surface buttons for secondary actions, text buttons for tertiary actions.
- Inputs: visible labels, 12px radius, full-perimeter border, inline units where
  useful, errors beneath the field.
- Nutrient strip: four compact columns with aligned numbers; text labels always
  accompany color.
- Recommendation row: leading icon, plain-language title, exact time or range,
  and a disclosure explaining the formula.
- Food row: time, food name, amount, calories, and a compact macro summary.
- Bottom sheet: used for quick food logging on mobile; expands into an inline
  side panel on wider screens.
- Toast: brief save/undo status; never used for validation errors.

## Motion

Motion only communicates state:

- Press feedback: 100ms.
- Sheet, disclosure, and tab transitions: 180–240ms with
  `cubic-bezier(0.22, 1, 0.36, 1)`.
- Newly saved entries may crossfade into the list; no page-load choreography.
- `prefers-reduced-motion` removes transforms and shortens transitions to an
  immediate crossfade.

## Content

Use “food”, “entry”, “daily target”, “weight check-in”, and “estimate”
consistently. Avoid “cheat”, “bad”, “earned”, “burn off”, and other moral or
punitive language. Errors explain what happened and how to fix it. Sensitive
calculation inputs include a one-sentence reason.

