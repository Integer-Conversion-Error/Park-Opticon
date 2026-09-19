# Backend API and test guide

**Status — 2026-08-25:** routes below are derived from
`backend/internal/router/router.go`. Use the API process and alert worker
together for live parked-car alert testing.

## Start the services

The easiest local path is Docker Compose:

```sh
cd backend
docker compose up --build
```

For a non-Docker workflow, start PostgreSQL + PostGIS first, then run these in
separate terminals:

```sh
go run ./cmd/server
go run ./cmd/worker
```

The API base URL is `http://localhost:8080`; all versioned endpoints are under
`/api/v1`.

## Authentication

Only registration, login, and token refresh are public.

```sh
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"driver@example.com","password":"password123","username":"driver"}'
```

Use the returned `access_token` for protected requests:

```sh
export TOKEN='…'
curl http://localhost:8080/api/v1/profile \
  -H "Authorization: Bearer $TOKEN"
```

## Driver routes

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/feed/nearby` | Requires `latitude`, `longitude`; optional `radius_meters` is 1–2,500. Returns spots and enforcement alerts. |
| `POST` | `/parking-sessions` | Starts the one active parking session for the user. Writes a durable alert lookup job. |
| `GET` | `/parking-sessions/active` | Gets the caller's active session. |
| `PATCH` | `/parking-sessions/:id/end` | Ends a session; optional `share_open_spot`. |
| `POST` | `/parking-sessions/:id/feedback` | Saves a post-parking enforcement observation. |
| `POST` | `/enforcement-alerts` | Creates or merges a `ticketing` or `chalking` report, then writes an alert job. |
| `GET` | `/enforcement-alerts/nearby` | Nearby active enforcement reports. |
| `PATCH` | `/enforcement-alerts/:id/resolve` | Resolves the caller's report or an admin's report. |
| `POST` | `/enforcement-alerts/:id/verifications` | Confirms or denies an enforcement report. |
| `GET` | `/parking-spots/nearby` | Nearby available spots. |
| `PATCH` | `/parking-spots/:id/taken` | Marks a spot as taken. |
| `POST` | `/parking-spots/:id/verifications` | Confirms or denies a parking report. |
| `GET` | `/profile/community-impact` | Returns the caller's event-backed reports shared, reports confirmed, reports checked, and unique drivers alerted. It does not return a reputation score. |
| `GET/PATCH` | `/profile/preferences` | Reads or changes alert preferences and radius. |
| `PATCH` | `/profile/push-token` | Registers a device push token; `null` clears active devices for the account. |
| `GET` | `/notifications` | Returns the caller's notification history and unread count. |
| `PATCH` | `/notifications/:id/read` | Marks one notification read. |
| `POST` | `/notifications/read-all` | Marks all notifications read. |

### Parked-car alert smoke flow

1. Sign in on one account/device and register its Expo push token.
2. Start a parking session near a test coordinate.
3. From a different account, report `ticketing` or `chalking` within that
   driver's configured radius.
4. Confirm a notification row appears and, on a real configured device, the
   Expo push is accepted. The queue worker runs on its configured short poll
   interval rather than a global 30-second scan.

Example report:

```sh
curl -X POST http://localhost:8080/api/v1/enforcement-alerts \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "latitude": 37.7749,
    "longitude": -122.4194,
    "enforcement_type": "ticketing",
    "severity": "high",
    "description": "Test report"
  }'
```

## Admin routes

All admin routes require a JWT for an admin user and a current MFA step-up.
Available groups are `/admin/users`, `/admin/parking-spots`,
`/admin/templates`, and `/admin/enforcement-alerts`; parking spot routes also
own the geofence endpoints. The source router is the authority for the exact
route list.

## Automated tests

```sh
cd backend
go test ./...
go vet ./...
```

The PostGIS integration tests are intentionally opt-in to avoid modifying a
developer's ordinary database. Point them at a disposable PostGIS database:

```sh
PARKOPTICON_TEST_DATABASE_URL='postgres://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=disable' \
  go test ./... -count=1
```

Those tests cover API outbox writes, report-to-session fan-out, park-time
matching, duplicate prevention, retry after a transient push-provider failure,
and concurrent migration startup.

## Mock mode

`go run ./cmd/server -mock` is useful only for immutable frontend fixtures. It
does not run database migrations, the alert worker, or real notification
delivery; do not use it to validate the live alert pipeline.
