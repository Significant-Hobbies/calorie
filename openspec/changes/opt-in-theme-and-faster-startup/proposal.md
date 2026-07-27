## Why

Calorie currently follows the device theme before the user makes a choice, so
dark mode can appear without being explicitly selected. Signed-in startup also
loads code for every tab and performs avoidable sequential account reads,
making a quick food journal feel heavier than it needs to.

## What Changes

- Make Light the first-run default while retaining explicit Light, Dark, and
  System choices in Settings.
- Load secondary tabs only when the user opens them.
- Combine the signed-in session and profile startup read into one app request.
- Preserve offline/local-mode fallbacks and the existing loading treatment.
- Measure the production build before and after the optimization.

## Capabilities

### New Capabilities

- `fast-app-startup`: Defines how the app limits initial code and account
  requests without weakening offline behavior.

### Modified Capabilities

- `adaptive-app-shell`: Changes the first-run theme from System to Light while
  keeping all three theme preferences available.

## Impact

- Browser app shell, theme preference helper, and private API client.
- Cloudflare Worker private app routes and request context.
- Design documentation and OpenSpec requirements.
- No new dependency, schema migration, or production configuration.
