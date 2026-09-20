# Park Opticon backend architecture

**Status — 2026-08-25:** this is the maintained architecture reference. The
backend is a Go/Gin API backed by PostgreSQL + PostGIS, with a separate
event-driven alert worker.

## Components

```text
React Native mobile app                 React/Vite admin portal
           │                                      │
           └──────────── REST / JWT ──────────────┘
                                  │
                             Go/Gin API
                                  │
                    PostgreSQL + PostGIS
                       │                    │
                 application data      alert_dispatch_jobs
                                             │
                                      Go alert worker
                                             │
                                     Expo Push Service
```

### API process

`cmd/server` provides the HTTP API and runs versioned migrations. It does not
run the alert worker. API instances are safe to scale independently once they
share the same database, subject to the normal database and rate-limit limits.

### Alert-worker process

`cmd/worker` also checks migrations, then starts the alert dispatcher and the
expiry/retention worker. Docker Compose runs it as the `alert-worker` service.
It has no HTTP listener.

Keeping these processes separate avoids the old failure mode where every API
replica scanned every active parking session.

## Alert delivery pipeline

```text
1. Report enforcement or start parking session
   └─ API transaction inserts domain row + alert_dispatch_jobs row

2. Worker claims a job with FOR UPDATE SKIP LOCKED
   ├─ enforcement report → find nearby active parked sessions
   └─ parking session    → find currently active nearby reports

3. Worker writes idempotent notification records and per-device deliveries

4. Worker batches Expo requests
   ├─ accepted delivery → mark sent and record provider ticket ID
   ├─ transient failure → reschedule with exponential backoff
   └─ permanent token failure → fail delivery and deactivate the device
```

The database-level uniqueness constraint prevents duplicate user-visible
notifications for the same alert. The worker only uses external network calls
after the fan-out transaction commits, so database locks remain short.

### Spatial matching

The schema stores locations as PostGIS `geography(POINT, 4326)` values. Alert
matching uses a 1,500-metre indexed prefilter, followed by the recipient's exact
100–1,500 metre preference. Partial GiST indexes contain only active alerts and
active parking sessions; this keeps expired history out of the hot path.

## Request and authorization model

- Gin validates JSON bodies and middleware adds request IDs, security headers,
  request logging, rate limits, and JWT authentication.
- The Go API is the authorization boundary. PostgreSQL tables are not exposed
  directly to clients.
- Admin routes require an admin claim and a recent MFA step-up.
- Public map/feed responses intentionally omit reporter identities.

See [API testing](API_TESTING.md) for the exact route list.

## Data ownership

| Data | Purpose |
| --- | --- |
| `users`, `user_sessions`, MFA tables | Accounts and authentication lifecycle |
| `parking_sessions` | One active parked location per user |
| `parking_spots`, `enforcement_alerts` | Crowdsourced geospatial reports |
| `notifications` | In-app notification history |
| `user_devices` | Active Expo push registrations per account |
| `alert_dispatch_jobs` | Durable alert/session matching work |
| `notification_deliveries` | Retryable, per-device push delivery state |

Runtime migration 23 introduced the alert jobs, device registrations, delivery
queue, and active spatial indexes. See [the migration guide](../../backend/migrations/README.md).

## Deployment boundaries

The supplied production Compose file defines PostgreSQL, an API container, and
an alert-worker container. It does **not** provide TLS termination, managed
backups, worker metrics, provider receipt polling, or high-availability
PostgreSQL. Those are release/operations requirements, not completed features.

## Validation

The worker has integration coverage for report fan-out, park-time alert lookup,
idempotency, and transient-delivery retry. It uses an opt-in disposable PostGIS
database; see [API testing](API_TESTING.md).
