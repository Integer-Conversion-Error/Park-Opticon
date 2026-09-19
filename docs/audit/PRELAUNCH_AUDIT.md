# Prelaunch audit

**Updated:** 2026-08-25  
**Scope:** current worktree: mobile app, admin portal, Go/PostGIS backend,
migrations, alert delivery, and Docker configuration.

## Verdict

The focused parking MVP has a materially stronger backend than the earlier
audit snapshot: it has real Expo submission, a durable event-driven alert
pipeline, separate worker deployment, migration concurrency protection, and
integration coverage. It is still **not ready for an unrestricted public
launch** because core operational/release controls remain incomplete.

## Resolved since the earlier snapshot

- Guest/offline map state is explicit rather than presenting synthetic live
  enforcement data.
- Mobile push-token registration, Expo submission, in-app notification history,
  and a durable alert worker are implemented.
- Alert processing is event-driven; it does not scan all parked sessions on a
  fixed 30-second loop.
- API report/session writes atomically enqueue alert work, retryable per-device
  delivery records exist, and transient provider failures retry.
- API and worker now start migrations safely when they come up concurrently.
- Fresh bootstrap migrations were repaired and tested against a clean PostGIS
  database.

## Release blockers

1. **HTTPS and edge routing:** production Compose still exposes the raw API;
   TLS termination/reverse proxy is not supplied by this repository.
2. **Operations:** no automated backup/restore drill, monitoring, error
   tracking, worker-lag alarm, or deployment smoke workflow exists.
3. **Real-device validation:** Expo access-token/project configuration and a
   full parked-car notification flow must be validated on supported devices.
4. **Mobile release quality:** the mobile package has no committed automated
   test/lint workflow; production API configuration and store readiness need
   verification.

## Important product/API gaps

- The Reports tab remains AsyncStorage/local-only rather than a complete remote
  report history.
- Profile identity and impact figures are placeholder content.
- The settings UI updates global notification preference but does not expose
  the separate backend `enforcement_alerts_enabled` preference.
- Admin dashboard calculations still rely on fields/routes that are not part
  of the backend contract; Analytics is a placeholder.
- Photo tables/configuration exist, but there is no completed upload/storage
  workflow.
- Provider receipt polling is not yet implemented; `sent` records provider
  submission acceptance, not guaranteed device display.

## Security and scale follow-up

- Move the in-memory per-process rate limiter to shared infrastructure before
  adding public API replicas.
- Add queue/delivery metrics and tune Postgres retention/autovacuum using real
  load data.
- Establish moderation/abuse controls for crowdsourced reports.
- Complete account lifecycle flows (verification, reset, deletion, device
  management) before broad release.

## Required release test

Run a documented end-to-end test covering registration, login, admin MFA,
location permission, parking session creation, nearby report creation, alert
delivery/retry, in-app acknowledgement, logout, and failure recovery. See
[API testing](../backend/API_TESTING.md).
