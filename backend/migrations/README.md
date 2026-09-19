# Database migrations

The backend's runtime migration path is the versioned list in
`internal/database/migrations.go`. It records applied versions in the
`schema_migrations` table and uses a transaction-level advisory lock so only
one backend instance can apply a migration at a time.
A separate short bootstrap advisory lock safely creates `schema_migrations`
when the API and alert worker start concurrently.

The SQL files in this directory are a fresh-database bootstrap path for
`scripts/init_db.sh`. They are applied in filename order and should not be
used as an incremental update path against an existing database. Start the
backend to apply tracked runtime migrations to an existing database.

When a schema change is needed:

1. Add the change to the next numbered runtime migration in
   `internal/database/migrations.go`.
2. Add the equivalent statement to the next SQL bootstrap file here.
3. Verify both the existing-database and fresh-database paths.

Migration `000_extensions.sql` installs the required PostGIS and `pgcrypto`
extensions before UUID/geography tables are created. Migration `007` adds the
mobile report lifecycle, notification preferences, proximity verification, and
anonymous open-spot timestamps. Migration `008` adds MFA state, hashed refresh
session metadata, account-token storage, and recovery-code storage.
Migration `009` (runtime version 21) removes the legacy plaintext refresh-token
values and index after the hash migration has completed.
Migration `010` (runtime version 22) normalizes legacy geofence columns to the
`geometry(POLYGON, 4326)` type used by the admin API.
Migration `011` (runtime version 23) adds the durable alert-dispatch outbox,
per-device push registrations and retryable notification-delivery jobs.
Migration `012` (runtime version 24) expands notification-radius preferences to
100–2,500 metres and changes the new-account default to 1,000 metres.
Migration `013` (runtime version 25) adds the indexes used by the authenticated
community-impact summary.
Migration `014` (runtime version 26) adds Google/Apple external-identity
mappings and one-time OAuth challenges. Provider identity is keyed only by the
immutable OIDC subject; no provider token is stored.
Migration `015` (runtime version 27) adds one-time reauthentication proofs for
linking a new external identity to an existing account.
