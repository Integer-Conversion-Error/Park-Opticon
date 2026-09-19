# Current roadmap

**Planning reference — 2026-08-25.** This is not a promise of dates. It lists
the most material work remaining after the current MVP implementation.

## Complete in the current worktree

- Go/PostGIS API with auth, parking sessions, enforcement reports, feed,
  notifications, admin MFA, and migrations.
- Expo mobile authentication, map, parking-session, enforcement-report,
  settings, and push-token flows.
- Durable event-driven alert dispatch, per-device delivery records, retry, and
  a separate worker service.
- Admin portal shell, MFA flow, parking spot/template/polygon views.

## Before a public beta

1. **Operations:** HTTPS proxy, secret management, backup/restore drills,
   database/worker/API monitoring, and deployment health checks.
2. **Mobile release validation:** lockfile discipline, lint/test coverage,
   production API configuration, and real-device alert delivery validation.
3. **Product correctness:** complete or remove stale/placeholder Reports,
   profile/impact, analytics, and admin statistics experiences.
4. **Abuse/moderation:** shared/distributed rate limiting, report moderation,
   fraud/quality controls, and incident response.

## Scale and reliability follow-up

- Add Expo receipt polling and delivery observability beyond provider
  submission acceptance.
- Archive/partition old spatial reports and tune autovacuum based on real load.
- Add queue-lag and fan-out metrics, then load-test dense multi-city traffic.
- Introduce a shared rate limiter before running multiple public API replicas.

## Explicitly out of scope today

- Direct client database access/RLS rollout.
- Photo upload/storage pipeline (schema/config exists, end-to-end flow does
  not).
- Full ticket-management and appeal workflows.
- Automated edge/sensor reporting integration.

Use [the prelaunch audit](../audit/PRELAUNCH_AUDIT.md) as the authoritative
release-risk record.
