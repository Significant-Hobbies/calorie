## 1. Calculation contract

- [x] 1.1 Extend nutrition targets with maintenance calories, signed goal adjustment, and goal-aware explanation.
- [x] 1.2 Add tests proving every goal produces a distinct documented target and manual/missing-input modes remain safe.
- [x] 1.3 Add a shared target-weight distance helper without promising a completion date.

## 2. Answer-aware onboarding

- [x] 2.1 Replace the four-step questionnaire with the three-step intent, inputs, and personalized-plan flow.
- [x] 2.2 Remove the unused gender question and move fasting-threshold selection out of onboarding.
- [x] 2.3 Add versioned user-scoped draft autosave, resume, completion cleanup, and sign-out cleanup.
- [x] 2.4 Show what each answer changes and render the live maintenance-to-goal arithmetic before completion.

## 3. Downstream use

- [x] 3.1 Show goal name and exact adjustment with the daily range on Today.
- [x] 3.2 Make target weight editable in Settings and explain how each saved assumption is used.
- [x] 3.3 Update demos, types, local/cloud responses, and documentation to the shared answer-to-outcome contract.

## 4. Production Google authentication

- [x] 4.0 Publish stable homepage, privacy, and terms links for the production OAuth consent screen.
- [x] 4.1 Create a dedicated Google OAuth web client with the production origin and Better Auth callback.
- [x] 4.2 Store Google client credentials and a Better Auth secret as Cloudflare Worker secrets.
- [x] 4.3 Verify Google configuration, provider redirect, callback, session creation, and per-user D1 profile access in production.

## 5. Validation and release

- [x] 5.1 Run formatting, lint, typecheck, unit tests, production build, strict OpenSpec validation, and Worker dry run.
- [x] 5.2 Exercise onboarding back/reload/resume, every goal mode, mobile/desktop layout, local persistence, and accessibility in a browser.
- [x] 5.3 Run Impeccable onboarding polish/audit checks and fix material findings.
- [x] 5.4 Update PROJECT_STATUS, archive the change, commit, push, pass exact-commit CI and deploy guard, then release and smoke-test production.
