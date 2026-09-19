# Release rectification plan

**Current plan — 2026-08-25.** This replaces the earlier historical plan.

## Phase 1: operational release gate

1. Put the API behind verified HTTPS/TLS termination.
2. Move deployment secrets into a secret manager and review CORS/trusted proxy
   configuration.
3. Establish PostgreSQL backups, restore drills, storage monitoring, and a
   tested migration deployment sequence.
4. Add API/worker/database metrics and alerting for queue lag, delivery
   failures, retry exhaustion, and connection-pool pressure.
5. Create a deployment smoke test that checks API health, migration version,
   worker activity, and a controlled notification.

## Phase 2: mobile/product correctness

1. Make the Reports tab a real remote data view or remove the implication that
   it is live.
2. Replace placeholder profile identity/statistics with authenticated data.
3. Expose the full notification preference model, including enforcement-alert
   opt-in/out.
4. Add mobile lint/tests and a real-device release checklist.
5. Decide and implement account lifecycle/device-management requirements.

## Phase 3: admin correctness

1. Align dashboard calculations with fields returned by backend routes.
2. Implement or remove statistics/user-detail client calls that lack backend
   endpoints.
3. Add pagination/search/filtering where admin lists can grow past the current
   default limit.
4. Validate polygon editing and admin MFA against a production-like backend.

## Phase 4: alert reliability and scale

1. Add Expo receipt polling and device-token lifecycle telemetry.
2. Instrument Postgres queue claim/fan-out/delivery latency and build a dense
   area load test.
3. Tune data retention/partitioning and autovacuum based on observed volume.
4. Replace per-process rate limits with shared/distributed enforcement before
   multi-replica public traffic.

No phase is complete merely because code exists; each requires its stated
validation in a deployment-like environment.
