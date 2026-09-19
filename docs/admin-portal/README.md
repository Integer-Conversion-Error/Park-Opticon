# Admin portal

The admin portal is a React/Vite client in `admin-portal/`. It calls the Go API
directly; it is not a standalone mock administration system.

## Run locally

```sh
cd admin-portal
cp .env.example .env
# Set VITE_API_URL=http://localhost:8080/api/v1 for a local backend.
npm ci
npm run dev
```

For a production build:

```sh
npm run lint
npm run build
```

`VITE_API_URL` is required for production builds. It must include `/api/v1`.

## Authentication and authorization

- Sign in with an account whose `is_admin` field is true.
- Admin access requires MFA enrollment and a current TOTP verification step.
- The portal intentionally holds its access token in memory; refreshing the
  browser requires a new sign-in.

## Current pages

- Dashboard
- Users
- Parking spots
- Map/polygon manager
- Templates
- Analytics placeholder

The server currently exposes admin users, parking spots, parking spot
geofences, templates, and enforcement-alert listing routes. The frontend also
contains calls for some statistics/user-detail endpoints that are not currently
registered by the backend; those views must not be treated as complete.

## Development modes

Use the full database-backed API to validate authorization, MFA, polygons, and
real admin data. Backend mock mode is fixture-only and does not faithfully
represent the full admin API or security behavior.

See [the backend API guide](../backend/API_TESTING.md) and
[the current-state audit](../audit/PRELAUNCH_AUDIT.md).
