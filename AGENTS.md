## Repository operating rules

This repository is independently operable. Its tracked instructions and
commands are authoritative; no sibling Fleet checkout is required. Keep changes
scoped, use the smallest relevant repo-local check, track durable follow-up in
this repository's GitHub Issues, and require explicit approval before deploys,
migrations, or credential changes.

## Project

- **Product:** Calorie
- **Stack:** Vite + React + TypeScript, Cloudflare Worker, D1, Better Auth with Google
- **Package manager:** pnpm
- **Local dev:** `pnpm dev`
- **Checks:** `pnpm check`
- **Deploy:** `pnpm deploy` (manual only)

## Product rules

- Keep food-entry flows mobile-first and fast enough to use immediately after eating.
- Store nutrient values as calories, carbs, protein, and fibre.
- Timing suggestions are informational estimates, not medical advice.
- Never expose one user's foods or entries to another user.

## Visual work

`PRODUCT.md` owns design context, `DESIGN.md` owns visual tokens and interaction
rules, and `PROJECT_STATUS.md` owns product delivery status.
