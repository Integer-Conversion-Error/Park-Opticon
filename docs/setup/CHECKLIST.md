# Development and release checklist

## Local development

- [ ] `backend/.env` exists and has a development-only `DB_PASSWORD`.
- [ ] `docker compose up --build` starts `postgres`, `backend`, and
  `alert-worker`.
- [ ] `curl http://localhost:8080/health` returns healthy.
- [ ] `parkopticon/.env` has a reachable `EXPO_PUBLIC_API_URL`.
- [ ] `admin-portal/.env` has `VITE_API_URL` ending in `/api/v1`.
- [ ] Mobile map opens with location permission granted.
- [ ] An admin account can complete MFA and access the portal.

## Automated validation

- [ ] `cd backend && go test ./...`
- [ ] `cd backend && go vet ./...`
- [ ] `cd admin-portal && npm run lint`
- [ ] `cd admin-portal && npm run build`

## Alert-flow validation

- [ ] A signed-in device registers an Expo push token.
- [ ] Starting a parking session creates an active session.
- [ ] A nearby enforcement report creates a notification for the parked user.
- [ ] A transient delivery failure is logged/retried by the worker.
- [ ] A real-device Expo push is accepted with production credentials.

## Public-release gate

- [ ] HTTPS termination is in place.
- [ ] Database backups and restore verification exist.
- [ ] API, database, worker, and notification metrics/alerts exist.
- [ ] Production secrets, CORS origins, and database TLS are configured.
- [ ] Mobile provider/device smoke test is documented and passed.
- [ ] The open items in [the prelaunch audit](../audit/PRELAUNCH_AUDIT.md) have
  been assessed and closed or explicitly removed from scope.
