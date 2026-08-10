## Context

The signed-in dashboard hydrates the Today food selector from a D1 query that
currently filters to the user's active foods, sorts by recent use and name, and
then applies `LIMIT 20`. The local journal already provides its complete active
food collection. Today also inserts every newly saved optimistic entry into its
current dashboard regardless of the chosen eaten date. See `proposal.md` and
the `daily-intake-log` delta for the required behavior.

## Goals / Non-Goals

**Goals:**

- Remove the private-cloud-only 20-food retrieval cap.
- Preserve ownership, lifecycle filtering, ordering, and the dashboard response
  shape.
- Protect the query contract with a focused regression test.
- Keep optimistic Today entries and nutrient totals aligned with the dashboard
  date and timezone.

**Non-Goals:**

- Pagination, virtualized rendering, or a new search API.
- Changes to food creation, archiving, sorting controls, or storage.
- Loading or rendering a historical-day journal on the Today screen.

## Decisions

- Keep dashboard hydration as the source for selector options and remove only
  the SQL `LIMIT`. This is the smallest compatible change and keeps local and
  cloud behavior aligned. A separate paginated/search endpoint was rejected
  because it would add client state and network latency to a mobile-first entry
  flow without evidence that the existing full-library payload is problematic.
- Name and export the dashboard food query so a unit test can assert the
  security/lifecycle predicates, ordering, and absence of a fixed cap without
  requiring production authentication or a D1 migration.
- Centralize the date-aware optimistic entry merge as a pure helper. It removes
  any prior copy of the saved entry, then adds the optimistic snapshot only when
  its eaten timestamp formats to `dashboard.date` in `dashboard.timezone`. This
  covers both backdated creation and editing an existing entry across a date
  boundary. Reloading the dashboard after each save was rejected because it
  would add latency and still leave the incorrect transient state visible.

## Risks / Trade-offs

- [Large libraries increase dashboard response size] → Saved food records are
  compact, and removing the cap prioritizes correctness; pagination can be
  introduced later if measured payloads justify it.
- [Query edits could weaken privacy or include archived foods] → Preserve and
  test the user and archive predicates explicitly.
- [Timezone boundaries could classify an entry incorrectly] → Compare using the
  dashboard's explicit IANA timezone and test a timestamp that differs by date
  between UTC and the dashboard timezone.

## Migration Plan

Deploy the Worker normally; no data or schema migration is required. Rollback is
the prior Worker version.
