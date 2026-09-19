# Park Opticon backend

The backend is a Go/Gin API backed by PostgreSQL + PostGIS. The database is
accessed through `database/sql`/`sqlx`, so the handlers do not depend on a
provider-specific SDK. That keeps the storage boundary portable for a later
Supabase migration.

## Run locally

Start PostgreSQL with PostGIS, copy `.env.example` to `.env`, then run:

```sh
go run ./cmd/server
```

In a second terminal, run the durable alert worker:

```sh
go run ./cmd/worker
```

The server applies the versioned runtime migrations at startup. The SQL files
under `migrations/` are the fresh-install bootstrap equivalent.

## Alert delivery architecture

Parking sessions and enforcement reports write an outbox job in the same
database transaction. The worker claims jobs with `FOR UPDATE SKIP LOCKED`,
uses PostGIS to fan out a new alert only to nearby active sessions, and creates
per-device delivery jobs. Provider failures retry with backoff, while a unique
notification key prevents duplicate user-visible alerts. The Compose files run
this worker separately from the API so HTTP replicas do not duplicate alert
processing.

## Core API

All routes below are under `/api/v1` and protected routes use
`Authorization: Bearer <access_token>`.

- `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`
- `POST /auth/oauth/challenge` — short-lived Apple nonce; `POST /auth/oauth/sign-in`
  — Google native server-auth code or Apple identity-token sign-in
- `GET /auth/identities`, `POST /auth/reauthenticate`,
  `POST /auth/identities` — list, freshly prove control of, then link a
  Google/Apple sign-in method (the link proof is single-use)
- `GET /profile`, `PATCH /profile/push-token`
- `GET/PATCH /profile/preferences` — notification radius is 100–2,500 metres
- `GET /feed/nearby?latitude=&longitude=&radius_meters=` — combined map feed
- `POST /parking-sessions`, `GET /parking-sessions/active`
- `PATCH /parking-sessions/:id/end` — accepts `share_open_spot`; shared spots
  become stale after five minutes and expire after fifteen
- `POST /parking-sessions/:id/feedback` — records the post-parking yes/no
  observation and confirms matching nearby enforcement reports
- `GET /parking-spots/nearby`, `PATCH /parking-spots/:id/taken`
- `POST /parking-spots/:id/verifications`
- `POST /enforcement-alerts`, `GET /enforcement-alerts/nearby`
- `POST /enforcement-alerts/:id/verifications`,
  `PATCH /enforcement-alerts/:id/resolve`
- `GET /notifications`, `PATCH /notifications/:id/read`,
  `POST /notifications/read-all`

Map/report responses intentionally omit public reporter IDs. The user who
shares an open spot is not exposed to nearby drivers.

## Supabase migration boundary

The current schema uses UUID primary keys, `timestamptz`, PostGIS geography
points, explicit foreign-key indexes, and short transactions. The migration
SQL avoids pinned extension versions and provider-specific functions beyond
PostGIS and `pgcrypto`.

When moving to Supabase:

1. Apply the numbered SQL migrations in a Supabase migration directory.
2. Keep the existing Go API pointed at the Supabase Postgres connection or
   pooler; no handler changes should be required.
3. Add RLS policies for user-owned sessions, feedback, notifications, and
   private profile data. Public map views should be exposed through a
   carefully scoped view/RPC that does not return reporter IDs.
4. Grant only the API role the tables/functions it needs. Do not rely on new
   tables being publicly exposed by the Data API.

The app currently remains the authorization layer. RLS is the next hardening
step before enabling direct Supabase client access.

## Security defaults

Production requires a strong `JWT_SECRET`, `MFA_ENCRYPTION_KEY`, non-wildcard
CORS origins, and TLS-enabled database connections. Admin routes require MFA
enrollment and a recent TOTP step-up. Refresh tokens are rotated and stored as
hashes. Do not use the development compose password or place admin credentials
in source control.
