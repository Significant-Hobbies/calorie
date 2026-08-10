## 1. Dashboard food retrieval

- [x] 1.1 Extract the active dashboard foods SQL into a named query and remove
  its fixed 20-row limit while preserving ownership, lifecycle, and ordering.
- [x] 1.2 Add a focused regression test for the uncapped, user-scoped active-food
  query contract.

## 2. Date-correct optimistic entries

- [x] 2.1 Add a date- and timezone-aware helper that includes optimistic entries
  only when they belong to the displayed dashboard date, including edits.
- [x] 2.2 Use the helper in the Today entry save flow and add regression coverage
  for backdated creation and cross-date editing.

## 3. Verification and release record

- [x] 3.1 Run the focused regression tests and the repository check suite.
- [x] 3.2 Record both shipped fixes in `PROJECT_STATUS.md`.
