# Docker deployment requirements

**Status — 2026-08-25:** `backend/docker-compose.prod.yml` runs PostgreSQL,
the API, and the alert worker. It is not by itself a complete internet-facing
production deployment.

## What the production Compose file provides

- A separate API and alert-worker container.
- PostgreSQL + PostGIS on an internal Compose network.
- Read-only API/worker containers with a temporary `/tmp` filesystem.
- Required production configuration validation in the Go processes, including
  strong JWT/MFA secrets, a non-wildcard CORS origin, controlled database
  transport, and an Expo access token.

## What must be supplied outside Compose

1. **TLS termination and routing.** Put the API behind a trusted HTTPS reverse
   proxy/load balancer. Do not expose the raw port-8080 service publicly.
2. **Database operations.** Establish encrypted off-host backups, restore
   drills, patching, storage monitoring, and a recovery plan. See
   [self-hosting](SELF_HOSTING.md).
3. **Secrets management.** Provide environment secrets through a deployment
   secret store, not committed files or shell history.
4. **Observability.** Collect API errors/latency, database pool health,
   alert-job lag, delivery retry/failure counts, and worker liveness.
5. **Release validation.** Verify migration application, mobile API URLs,
   Expo project/access-token configuration, and real-device push delivery.
6. **Scaling plan.** API replicas may scale independently. Worker replicas
   share the Postgres queue safely through `SKIP LOCKED`; size the database
   connection pool and monitor queue contention before increasing replicas.

## Deployment outline

```sh
cd backend
# Populate .env.prod and /etc/parkopticon/backup.env with root-only
# permissions, then deploy the current revision.
./deploy.sh
```

Before declaring success, check API health through the HTTPS endpoint, inspect
both API and worker logs, and run the real-device smoke flow in
[API testing](API_TESTING.md).

## Known boundaries

- Expo submission acceptance is recorded, but provider receipt polling is not
  currently implemented.
- `/health` validates database connectivity; it is not a worker-health or
  queue-lag endpoint.
- The backup and recovery workflow is documented in
  [self-hosting](SELF_HOSTING.md); it still requires a host cron/systemd timer
  and an off-host encrypted copy.

These are release requirements, not optional hardening for a public launch.
