# Mock mode

Mock mode starts an immutable in-memory fixture API:

```sh
cd backend
go run ./cmd/server -mock
```

It is intended for quick frontend/API-shape experimentation only.

## What mock mode does

- Serves fixture authentication, profile, nearby-spot, nearby-alert, vehicle,
  ticket, parking-session, and selected admin endpoints.
- Does not require PostgreSQL.
- Does not persist writes; mock create/update/delete responses are fixtures.

## What mock mode does not do

- Run versioned database migrations.
- Run `cmd/worker`, alert dispatch jobs, spatial PostGIS matching, or Expo
  delivery.
- Match the full production API route set or authorization behavior.
- Validate mobile parked-car protection or admin MFA workflows.

Use the Docker/full stack and [API testing](API_TESTING.md) for any feature
that depends on real data, geospatial queries, notifications, or migrations.
