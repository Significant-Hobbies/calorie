# Design

`ios-landings` remains the landing source. Because that repo is private
and Calorie is public, Calorie vendors a static snapshot at
`marketing/` instead of importing Astro at build time.

```mermaid
flowchart LR
  Landing[ios-landings PRODUCT=calorie] -->|sync snapshot| Marketing[calorie/marketing]
  Vite[Vite journal] --> DistApp[dist/app]
  Marketing --> DistRoot[dist/]
  DistRoot --> Worker[calorie Worker]
  DistApp --> Worker
```

`/api/*` stays on the Worker. `/app` and `/app/*` are rewritten to
`/app/index.html` except hashed assets. Everything else is static
assets, including the landing.

Google `callbackURL` becomes `{origin}/app/`.
