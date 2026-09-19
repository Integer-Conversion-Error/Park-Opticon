# Park Opticon

Park Opticon is a parking-safety application with a React Native mobile app, a
Go/PostGIS API, and a React/Vite admin portal. Drivers can save where they
parked, report nearby enforcement activity, view a local map feed, and receive
nearby enforcement alerts.

> **Repository status — 2026-08-25:** the focused parking MVP is implemented
> and its backend test suite passes. It is not yet a public-production release:
> real-device push validation, HTTPS/reverse-proxy deployment, backups,
> monitoring, and release smoke tests still need to be completed.

## What is implemented

- Email/password authentication with rotating refresh tokens and MFA support
  for admin step-up.
- A mobile map feed for nearby parking spots and enforcement reports.
- Parking sessions: drivers mark where they parked and can share an open spot
  when they leave.
- Crowdsourced enforcement reporting, proximity verification, and expiry.
- Event-driven parked-car alerts. A report or a newly started parking session
  writes a durable database job; a separate worker matches nearby active
  sessions and delivers Expo push notifications with retry handling.
- A protected admin portal for users, parking spots, templates, polygons, and
  enforcement-alert views.

## Architecture

```text
Mobile app / Admin portal
          │ HTTPS/REST
          ▼
      Go/Gin API ───────► PostgreSQL + PostGIS
          │                         │
          └──── durable alert jobs ─┘
                                    │
                              Alert worker
                                    │
                              Expo Push Service
```

The API and alert worker are separate processes. This prevents API replicas
from duplicating alert scans and lets workers claim jobs safely with PostgreSQL
row locking. Read the full design in [the backend architecture guide](docs/backend/ARCHITECTURE.md).

## Local development

### Backend and worker

The Docker development stack starts PostgreSQL, the API, and the alert worker:

```sh
cd backend
cp .env.example .env
# Set DB_PASSWORD in .env.
docker compose up --build
```

The API is available at `http://localhost:8080`; the worker has no HTTP port.
For a non-Docker workflow, start these in separate terminals after PostgreSQL
is available:

```sh
cd backend
go run ./cmd/server
go run ./cmd/worker
```

### Mobile app

```sh
cd parkopticon
cp .env.example .env
# Set EXPO_PUBLIC_API_URL to the API origin, without /api/v1.
npm ci
npm run start
```

Use `npm run android` or `npm run ios` as appropriate. The web script exists
but its dependencies/release path are not currently validated. Live reports
and server-side parked-car alerts require a configured API URL and an
authenticated account. Guest mode is intentionally local/offline only.

### Admin portal

```sh
cd admin-portal
cp .env.example .env
# Set VITE_API_URL to the API base, including /api/v1.
npm ci
npm run dev
```

The admin portal requires an account with `is_admin = true`; admin mutations
also require MFA enrollment and a recent verification step.

## Validation

```sh
cd backend
go test ./...
go vet ./...
```

The backend also contains opt-in PostGIS integration tests. See [API testing](docs/backend/API_TESTING.md)
for the disposable-database command. The mobile package currently has no
automated test or lint script; validate it on a simulator or real device.

## Documentation

Start at [docs/README.md](docs/README.md). It identifies the maintained guides
and labels older design/setup snapshots as historical references rather than
current operating instructions.

## Repository layout

```text
admin-portal/  React/Vite administration UI
backend/       Go API, PostGIS migrations, alert worker, deployment files
docs/          Maintained guides plus clearly marked historical references
parkopticon/   Expo / React Native mobile application
```
