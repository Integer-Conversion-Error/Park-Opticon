# Quick start

This is the current local-development path for the repository.

## 1. Start the backend stack

```sh
cd backend
cp .env.example .env
# Set DB_PASSWORD in .env.
docker compose up --build
```

This starts PostgreSQL + PostGIS, the Go API at `http://localhost:8080`, and
the independent alert worker.

## 2. Start the mobile app

```sh
cd parkopticon
cp .env.example .env
# Set EXPO_PUBLIC_API_URL to the API origin, without /api/v1.
npm ci
npm run start
```

Use the Expo CLI prompts for Android or iOS. The mobile web path is not
currently validated because its web dependencies/release workflow remain
incomplete. A real configured API and authenticated user are required for live
reports and parked-car alerts.

## 3. Start the admin portal (optional)

```sh
cd admin-portal
cp .env.example .env
# Set VITE_API_URL=http://localhost:8080/api/v1
npm ci
npm run dev
```

Use a real admin account and complete MFA when prompted.

## Verify

```sh
curl http://localhost:8080/health
cd backend && go test ./...
cd ../admin-portal && npm run lint && npm run build
```

For deployment boundaries and alert testing, see [the documentation home](../README.md).
