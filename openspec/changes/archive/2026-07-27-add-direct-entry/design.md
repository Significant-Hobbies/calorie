## Context

Today only creates entries by selecting a reusable food, even though an entry
already stores its own name, amount, unit, nutrient totals, and nullable food
reference. Local, demo, and Worker-backed journals all expose the same client
entry API and must preserve equivalent behavior.

## Goals / Non-Goals

**Goals:**

- Make one-off logging available from the existing mobile entry sheet.
- Keep direct entries editable and private in every storage mode.
- Preserve server-side nutrient calculation for entries based on saved foods.
- Avoid a D1 migration and avoid adding dependencies.

**Non-Goals:**

- Creating a second entry list or a separate journal concept.
- Saving direct-entry values into the reusable Foods library.
- Changing quick-add behavior, nutrient guidance formulas, or history totals.

## Decisions

- The entry editor will expose two explicit sources: “Saved food” and “Just
  this entry.” This keeps the common saved-food path fast while making the
  one-off path discoverable.
- A direct draft captures a name, positive amount, short unit label, four
  non-negative nutrient totals, and eaten time. These are the same snapshot
  fields already stored on every entry.
- Entry write inputs will accept `foodId: string | null`. When it is present,
  every storage implementation looks up the user-owned food and calculates the
  snapshot from that definition. When it is null, each implementation validates
  and persists the submitted snapshot without creating a food.
- Editing can switch an entry between saved-food and direct modes. Existing
  entries whose food was deleted open as direct entries using their retained
  snapshots.
- Undo will recreate either kind of entry through the same write path; direct
  entries no longer require a dashboard reload to recover.

## Risks / Trade-offs

- [Manually entered nutrients may be inaccurate] → Label the mode as a one-off
  entry and keep all values visible and editable; calculations remain
  informational.
- [The sheet becomes longer in direct mode] → Show direct fields only after the
  user chooses that mode and retain the compact saved-food form by default.
- [Client and Worker validation could drift] → Use the same field ranges and
  run the project TypeScript/Biome check across every changed path.
