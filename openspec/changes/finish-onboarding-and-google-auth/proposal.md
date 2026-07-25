## Why

Calorie’s onboarding currently asks for more information than it visibly uses:
one field is entirely unused, incomplete answers disappear on reload, and the
goal adjustment is hidden after selection. This makes a supposedly
personalized plan feel indifferent to the user’s answers; production Google
sign-in is also implemented but not configured.

## What Changes

- Replace the four-step questionnaire with a shorter three-step flow that
  starts with the user’s goal and reaches a live personalized plan before
  completion.
- Remove the unused gender-identity question and move the nonessential fasting
  threshold to Settings with a safe existing default.
- Explain what every remaining answer changes and immediately show maintenance
  calories, the selected goal adjustment, daily range, protein range, fibre
  target, target-weight distance, water target, and sleep time.
- Persist and resume an incomplete onboarding draft without overwriting an
  existing completed profile.
- Make target weight editable and show goal context wherever the daily range is
  presented.
- Create and configure a dedicated Google OAuth web client for the production
  origin and Better Auth callback, store credentials as Cloudflare secrets, and
  verify the real sign-in round trip.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `private-account-setup`: Make onboarding answer-aware, resumable, concise,
  editable, and backed by working production Google authentication.
- `transparent-guidance`: Expose the selected goal’s mathematical effect and
  the inputs behind the personalized plan.

## Impact

- Frontend onboarding, Today summary, Settings, local draft storage, profile
  types, and deterministic recommendation helpers.
- Existing profile and D1 schemas remain backwards compatible; the unused
  gender field is retained in storage but removed from the product UI.
- Production Google Cloud OAuth configuration and Cloudflare Worker secrets.
- No new runtime dependency, AI service, or data migration.
