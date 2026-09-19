# Current database schema overview

**Status — 2026-08-25:** this replaces an older aspirational schema document.
The authoritative definitions are the runtime migrations in
`backend/internal/database/migrations.go`; the matching SQL files under
`backend/migrations/` are for fresh databases only.

## Core application tables

| Area | Main tables | Notes |
| --- | --- | --- |
| Accounts | `users`, `user_sessions`, `account_tokens`, `user_mfa_recovery_codes` | JWT refresh state, MFA, account tokens |
| Vehicles | `vehicles` | Optional vehicle linked to a parking session |
| Parking | `parking_spots`, `parking_sessions`, `parking_session_feedback` | One active session per user; optional open-spot sharing |
| Enforcement | `enforcement_alerts`, `verifications` | Supported report types are `ticketing` and `chalking` |
| Notifications | `notifications`, `user_devices`, `notification_deliveries` | In-app history and per-device Expo submission/retry state |
| Alert pipeline | `alert_dispatch_jobs` | Durable report/session matching work |
| Administration | `audit_logs`, `geofence_zones`, templates/schedules | Admin audit and parking-management support |

## Geospatial data

`parking_spots`, `parking_sessions`, and `enforcement_alerts` store a PostGIS
`geography(POINT, 4326)` location plus latitude/longitude fields. Nearby APIs
use `ST_DWithin`/`ST_Distance`. Active enforcement alerts and active parking
sessions also have partial GiST indexes for alert matching.

`parking_spots.geofence` is `geometry(POLYGON, 4326)`, matching the admin
polygon API. The legacy bootstrap path is normalized by migration 010.

## Alert data model

An enforcement report or a parking-session start transaction creates an
`alert_dispatch_jobs` record. The alert worker claims it, creates an idempotent
`notifications` row for every matched user, and creates
`notification_deliveries` rows for their active `user_devices`.

`notification_deliveries` records pending/processing/sent/failed states,
attempt counts, locking fields, provider ticket IDs, and errors. A `sent`
delivery means Expo accepted the submission; receipt polling is future work.

Notification-radius preferences range from 100 to 2,500 metres. New accounts
default to 1,000 metres; existing saved preferences are retained during the
range-expansion migration.

## Retention and privacy

The expiry worker marks expired reports and performs current retention/anonymity
cleanup. It is not a substitute for a backup policy or a long-term analytics
retention design. Consult the source worker and migrations before changing
retention behavior.

## Changing the schema

1. Read [the migration guide](../../backend/migrations/README.md).
2. Add the next runtime migration in `backend/internal/database/migrations.go`.
3. Add the matching fresh-bootstrap SQL file.
4. Test both existing-database and fresh-bootstrap paths against disposable
   PostGIS databases.
