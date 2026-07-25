## Context

The current four-step onboarding stores all answers only at completion. It asks
for gender identity even though no calculation or presentation uses it, hides
the goal adjustment inside the energy formula, and does not seed the current
weight from any resumable draft. The resulting profile does affect Today,
Progress, fasting, hydration, and sleep, but those links are not shown.

The app must remain fully account-free and local-first. Google authentication
is a second persistence mode, not a prerequisite. Existing local profiles,
cloud rows, and D1 columns must remain compatible.

## Goals / Non-Goals

**Goals:**

- Reach first value within three short steps by showing a personalized plan
  before the user commits.
- Make every onboarding question either visibly consequential or remove it.
- Persist incomplete answers safely across navigation and reloads.
- Reuse the same deterministic plan calculation in onboarding, Today, and
  Settings.
- Enable and verify Google OAuth on the production origin with minimum identity
  scopes.

**Non-Goals:**

- Medical weight-loss prescriptions or guaranteed timelines.
- Changing the D1 schema or deleting the legacy nullable gender column.
- Migrating an existing local journal into a Google account.
- Adding a new authentication or form dependency.

## Decisions

### Use a three-step intent → inputs → plan flow

Step 1 asks name, units, goal, and target weight. Step 2 asks only the inputs
needed for energy math: current weight, age, height, equation profile, and
activity. Step 3 shows the personalized plan alongside wake time, sleep need,
and water target. The fasting threshold keeps its existing 12-hour default and
moves to Settings because it is not needed to demonstrate first value.

This ordering lets later copy acknowledge the selected goal and makes the
calculation consequence visible before completion.

### Remove unused gender identity from the UI

The separate equation profile is the only sex-based calculation input.
`genderIdentity` remains nullable in stored profiles for compatibility but new
onboarding submissions set it to `null`. This avoids asking a personal question
that the product cannot justify.

### Extend the deterministic target result with visible working

`calculateNutritionTarget` will return maintenance calories and the selected
goal adjustment in addition to the existing target and nutrient ranges. Today,
Settings, and onboarding will use those fields to display, for example,
“2,250 maintenance − 500 for faster loss = 1,750 kcal.”

Target weight remains a progress destination rather than an input to calorie
math. The UI will state that distinction and show distance from current weight
without promising an arrival date.

### Autosave a versioned, user-scoped onboarding draft

The browser stores a small `v2` draft keyed by profile user id. Draft values
take precedence over defaults only while onboarding is incomplete. Completion
and sign-out remove the applicable draft. Invalid or old versions are ignored.
The draft never replaces a completed profile.

### Configure Google as a minimal OIDC web client

The OAuth client will use:

- Authorized JavaScript origin:
  `https://calorie.significanthobbies.com`
- Authorized redirect URI:
  `https://calorie.significanthobbies.com/api/auth/callback/google`
- Scopes: `openid`, `email`, `profile`

The client id, client secret, and a generated Better Auth secret are stored with
`wrangler secret put`; no secret enters source control, shell history, logs, or
the browser transcript. The public callback follows Better Auth’s default
provider route.

## Risks / Trade-offs

- **Draft contains body measurements in browser storage** → This matches the
  existing local-first storage model; scope it by user id and clear it on
  completion/sign-out.
- **A faster-loss option can sound prescriptive** → Show the exact arithmetic,
  keep the existing bounded estimate, use “faster” rather than “fast,” and
  repeat that the range is informational.
- **Target weight may imply a promised timeline** → Show only distance and
  progress, never a completion date.
- **OAuth consent configuration may require Google review or test-user mode** →
  Request only basic identity scopes, provide the production homepage, and
  report any Google-side publication limitation explicitly.

## Migration Plan

1. Ship backwards-compatible frontend and calculation changes.
2. Create the Google OAuth web client and set Cloudflare secrets.
3. Deploy through the Fleet guard.
4. Verify local onboarding resume, goal arithmetic, Settings edits, and the
   complete production Google redirect/callback/session flow.
5. Roll back the Worker version if authentication or onboarding regresses;
   existing profiles and D1 data require no rollback.

## Open Questions

- None. The existing four goal modes and their mathematical adjustments remain
  the source of truth.
