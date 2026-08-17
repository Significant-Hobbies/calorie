# Serve the shared landing at / and the journal at /app

## Why

The public Calorie host should open on the shared ios-landings front
door. The journal stays a web app, just not on `/`.

## What

- Vite journal builds to `/app/`
- Worker serves the committed landing snapshot at `/`
- Auth and the PWA start URL follow the journal to `/app/`
- Calorie stays independently buildable (no private ios-landings clone)

## Out

- Deploying the Worker
- Deleting Indulge, Setline, Anchor, or Motion live `site/` folders
