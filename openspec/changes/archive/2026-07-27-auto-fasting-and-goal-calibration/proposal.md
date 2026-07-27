## Why

The timing dashboard currently calls a meal-driven estimate a “Gym window” and
counts only eating gaps that cross a manually selected fasting threshold. The
nutrition goal also uses mild fixed calorie adjustments and a protein range
that is low for a user who exercises, making the guidance less useful than the
food log it is derived from.

## What Changes

- Rename the meal-derived training recommendation to “Next best exercise
  window” so it does not imply that Calorie knows whether a workout happened.
- Derive each completed fasting window automatically from the last food logged
  on one eating day to the first food logged on the next eating day.
- Show the latest completed fasting duration and its start/end times instead of
  a count filtered by a user-selected threshold.
- Remove the fasting-threshold control from Settings while retaining stored
  profile data for backward compatibility.
- Increase automatic loss adjustments to a 500 kcal gradual deficit and a
  750 kcal faster deficit, with an automatic-target floor of 1,200 kcal/day.
- Raise weight-derived protein guidance to an exercise-oriented range:
  1.6–2.0 g/kg for loss goals and 1.4–1.8 g/kg for maintenance or gain.
- Keep manual calorie targets as an explicit override and preserve the
  informational, non-medical framing.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `transparent-guidance`: Replace threshold-counted fasting with automatic
  overnight food-to-food windows, clarify the exercise-window label, and
  recalibrate transparent calorie and protein target rules.

## Impact

- Pure calculations and their unit tests in `src/lib/recommendations.ts`.
- Local and Worker dashboard/history assembly.
- Today and Settings copy and controls.
- The existing `transparent-guidance` specification and product status.
- No new dependency, database migration, deployment, or account-data change.
