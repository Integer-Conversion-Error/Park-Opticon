# Installation commands

## Prerequisites

- Docker Engine with Compose v2 for the backend stack
- Node.js LTS and npm for mobile/admin work
- Android Studio/Xcode only when running a native emulator or simulator

## Backend

```sh
cd backend
cp .env.example .env
# Edit DB_PASSWORD.
docker compose up --build
```

Alternative without Docker: install PostgreSQL with PostGIS, configure
`backend/.env`, then run `go run ./cmd/server` and `go run ./cmd/worker` in
separate terminals.

## Mobile

```sh
cd parkopticon
cp .env.example .env
npm ci
npm run start
```

Set `EXPO_PUBLIC_API_URL` to the API origin, without `/api/v1`, before testing
live data. Production must use HTTPS.

## Admin portal

```sh
cd admin-portal
cp .env.example .env
npm ci
npm run dev
```

Set `VITE_API_URL` to the API base including `/api/v1`.

## Checks

```sh
cd backend && go test ./... && go vet ./...
cd ../admin-portal && npm run lint && npm run build
```
