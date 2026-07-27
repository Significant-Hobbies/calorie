## Context

Calorie currently treats any adjacent food-entry gap above a saved 12/14/16
hour threshold as a completed fast. The Today page then shows only the number
of qualifying gaps. This hides the useful duration and makes the result depend
on a setting instead of the user's actual eating-day boundaries.

Automatic energy targets currently apply fixed −250/−500 kcal loss adjustments
and use 1.2–1.6 g protein/kg for every goal. NIDDK describes 500–750 kcal/day as
a moderate deficit and advises against intake below 1,200 kcal/day in its
general prevention guidance. The ISSN position stand describes 1.4–2.0 g
protein/kg/day as sufficient for most exercising people, with potentially
higher needs during hypocaloric periods.

Sources:

- https://www2.niddk.nih.gov/-/media/Files/Health-Information/Health-Professionals/Diabetes/health-care-professionals/Guiding-Principles.pdf
- https://www.niddk.nih.gov/health-information/diabetes/overview/preventing-type-2-diabetes/game-plan
- https://pubmed.ncbi.nlm.nih.gov/28642676/

## Goals / Non-Goals

**Goals:**

- Make a completed fasting window mean the actual overnight interval from the
  prior eating day's final food to the next eating day's first food.
- Show the latest completed duration and endpoints directly on Today.
- Make automatic loss and protein targets more useful to an exercising user
  while keeping their inputs, arithmetic, and safety floor visible.
- Preserve local/cloud behavior parity and existing profile compatibility.

**Non-Goals:**

- Tracking workout completion or exercise sessions.
- Predicting an in-progress fast before the user logs the food that ends it.
- Adding a goal date, adaptive metabolic model, or clinical diet plan.
- Removing the legacy fasting-threshold database column in a migration.

## Decisions

1. **Group food entries by the dashboard timezone and use eating-day
   boundaries.** For each local date with food, retain its first and last entry.
   A completed window runs from one active date's last entry to the following
   active date's first entry. This avoids treating ordinary same-day meal gaps
   as fasting windows. Comparing every adjacent entry without a threshold was
   rejected because it would label lunch-to-dinner gaps as fasts.

2. **Keep the existing `FastWindow` transport shape.** `startAt`, `endAt`, and
   `durationHours` already express the result. The calculation will accept a
   timezone instead of a threshold, so local storage, the Worker dashboard, and
   history share the same deterministic rule without an API schema change.

3. **Hide rather than migrate the saved threshold.** Settings will no longer
   display or describe it. The profile field and D1 column remain temporarily
   accepted so existing accounts and queued profile writes continue to work.

4. **Use stronger fixed loss adjustments with an automatic floor.** Gradual
   loss uses −500 kcal and faster loss uses −750 kcal. Automatic targets are
   clamped to at least 1,200 kcal/day, and `goalAdjustmentCalories` reports the
   actual applied adjustment if that floor limits the requested deficit.
   Percentage deficits were considered but rejected because the current UI
   promises an exact, inspectable signed adjustment.

5. **Vary protein range by goal.** Loss goals use 1.6–2.0 g/kg/day; maintenance
   and gain use 1.4–1.8 g/kg/day. These stay within the exercise-oriented range
   in the cited position stand without assuming the user is a lean competitive
   athlete. The same weight-derived range remains available when the energy
   equation is skipped or calories are manually overridden.

## Risks / Trade-offs

- **Sparse logging can produce an unusually long fasting duration** → Show the
  exact endpoints so the user can spot missing food entries; do not claim
  medical significance.
- **Calendar grouping depends on timezone** → Use the timezone already supplied
  with dashboard/history requests and the device timezone for local mode.
- **A universal 1,200 kcal floor cannot personalize every clinical constraint**
  → Apply it only to automatic estimates, preserve the manual override, and
  keep the existing professional-guidance disclaimer.
- **The hidden threshold field becomes legacy data** → Retain it until a future
  schema cleanup is explicitly authorized; do not migrate it in this change.

## Migration Plan

Ship as an application-only update. Existing profile rows and local-storage
documents remain readable. Rollback restores the old calculation and Settings
control without transforming stored data.

## Open Questions

None.
