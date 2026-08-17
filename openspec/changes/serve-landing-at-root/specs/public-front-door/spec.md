# Public front door

## Requirements

### Requirement: Journal lives under /app

The Vite app SHALL load at `/app/` and SHALL NOT own `/`.

#### Scenario: Open the journal

- **WHEN** a visitor opens `/app/`
- **THEN** the food journal shell loads

### Requirement: Landing owns the origin root

`/` SHALL serve the Calorie marketing page, not the journal splash.

#### Scenario: Front door

- **WHEN** a visitor opens `/`
- **THEN** the response is the landing HTML and names Calorie
