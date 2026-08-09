## Context

See `proposal.md` for motivation. The weekly surface currently receives all required timestamps in the bounded `HistoryResponse`, but renders seven independent chronological lists. The month view and its selected-day detail are stable mobile behavior and must remain unchanged. The existing design system requires compact, neutral journal language, keyboard access, non-colour event cues, and no nested-card layout.

## Goals / Non-Goals

**Goals:**

- Make time the primary spatial dimension of the desktop weekly journal.
- Make period navigation self-explanatory and provide a direct return to the current period.
- Keep dense or simultaneous entries distinguishable, keyboard readable, and filterable.
- Reuse the current bounded history request and local timestamps.

**Non-Goals:**

- Editing or creating entries directly from the Progress calendar.
- Changing the compact month calendar below the desktop breakpoint.
- Persisting layout coordinates or adding calendar/database fields.
- Adding drag, resize, agenda, or multi-week modes.

## Decisions

### Use a vertically scrollable 24-hour grid

The weekly viewport uses seven day columns and a labelled `00:00` through `24:00` time axis. Event vertical position is derived from local minutes after midnight. This mirrors the mental model of a calendar and makes meal timing comparable across days. A virtualized list was rejected because the fixed 24-hour surface is small and virtualization would complicate accessibility and sticky headers without a measurable benefit.

### Render every log as a semantic event block

Food, weight, and medicine records stay in chronological DOM order within each day and become absolutely positioned event blocks in the visual grid. Type-specific iconography, labels, and surface tints preserve meaning without relying on colour. Food events lead with the food name and retain calories and the nutrient-density badge when space permits.

### Resolve collisions in a pure layout helper

Events receive a minimum visual duration so their content remains usable. Intersecting intervals are grouped and assigned side-by-side lanes; the displayed timestamp always remains the recorded timestamp. Each event is an accessible button that reveals a full-width detail strip below the grid, so narrow collision lanes do not hide the underlying log. Keeping the position calculation in a pure helper makes edge cases deterministic and testable.

### Keep navigation outside the scrolling grid

The period label, Previous, Today, and Next controls remain visible above the grid. Today is disabled in the current period, Next is disabled at the present boundary, and every control names the period it changes. The grid scrolls to an useful starting hour after a week/filter change while the full day remains reachable.

### Use a small session range cache with stale-while-revalidate behavior

Calendar responses are cached by user identity and ordered date-key signature in module memory. Returning to a previously viewed range seeds component state synchronously and keeps the grid mounted while a background request refreshes it. Dashboard, cycle, and trend snapshots use the same user scope so returning to Progress does not flash a full-page skeleton. The caches are bounded and session-only so they improve back-and-forth navigation without persisting private history or allowing old data to survive a reload. A general API response cache was rejected because write invalidation across food, weight, water, and medicine mutations would broaden this change considerably.

### Preserve responsive separation

At widths below 1000px the existing month calendar and selected-day detail remain the only calendar surface. The 24-hour grid is intentionally desktop-only; compressing seven timed columns onto a phone would make events unreadable.

## Risks / Trade-offs

- [Dense clusters can create narrow event blocks] → Assign deterministic lanes, compact secondary metadata first, and keep complete event labels accessible to assistive technology.
- [A full day is tall] → Use a bounded scroll viewport, sticky day headers, and an automatic initial scroll near the earliest visible event.
- [Absolute positioning can diverge from reading order] → Preserve chronological semantic lists per day and use CSS only for visual placement.
- [Locale conventions may prefer 12-hour clocks] → Use explicit 24-hour labels and `HH:mm` event times because this surface is intentionally a 24-hour calendar.
- [A cached range can briefly show stale data] → Refresh in the background on access, replace the cache on success, and keep failures non-destructive when usable cached data already exists.

## Migration Plan

Ship as a frontend-only replacement for the desktop weekly renderer. Rollback is the previous component and style block; persisted data and API behavior are unchanged.
