# Development setup guide

Use this guide for the current repository. Older Figma/emulator walkthroughs
were replaced because they described screens, packages, and backend services
that are no longer part of the implementation.

## Backend requirements

The backend needs PostgreSQL with PostGIS. Docker Compose is the supported
local path and starts all three application services:

- `postgres`
- `backend` (Go API)
- `alert-worker` (event-driven alert and expiry work)

Create `backend/.env` from `.env.example`, set `DB_PASSWORD`, then run:

```sh
cd backend
docker compose up --build
```

Do not test parked-car alerts with only `cmd/server`; the worker is a separate
process. When running without Docker, launch both `go run ./cmd/server` and
`go run ./cmd/worker`.

## Mobile requirements

Install Node.js LTS and the dependencies in `parkopticon/` with `npm ci`. Copy
`.env.example` and set:

```dotenv
EXPO_PUBLIC_API_URL=http://YOUR_API_HOST:8080
EXPO_PUBLIC_EXPO_PROJECT_ID=…
```

Use an address reachable from the device or emulator. The API URL intentionally
does not contain `/api/v1`; the app adds that path itself.

Use `npm run start` for Expo. Basic UI/location testing can use the platform
tools appropriate to the host; production push validation requires a real
Expo-compatible device build and server-side Expo credentials.

## Admin portal requirements

Copy `admin-portal/.env.example` and set:

```dotenv
VITE_API_URL=http://YOUR_API_HOST:8080/api/v1
```

Run `npm ci` and `npm run dev`. The portal needs a real admin account plus
MFA—being able to load the login page does not validate admin authorization.

## Security and release checks

- Use HTTPS for production API URLs.
- Never commit `.env` files or secrets.
- Run backend tests/vet and admin lint/build before handoff.
- Verify API health, database migrations, alert worker logs, and a real-device
  alert flow before public release.

See [the prelaunch audit](../audit/PRELAUNCH_AUDIT.md) for remaining blockers.
