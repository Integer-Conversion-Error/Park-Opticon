# Docker quick start

This is the maintained Docker development guide for the Go/PostGIS backend.

## Prerequisites

- Docker Engine with Compose v2
- A `backend/.env` file with `DB_PASSWORD` set

```sh
cd backend
cp .env.example .env
# Edit DB_PASSWORD and any optional Expo credentials.
docker compose up --build
```

## Services

| Service | Purpose | Host exposure |
| --- | --- | --- |
| `postgres` | PostgreSQL 15 + PostGIS | `localhost:5432` in development |
| `backend` | Go/Gin HTTP API | `http://localhost:8080` |
| `alert-worker` | Durable alert matching, push delivery, expiry work | none |

The API and worker both run migrations safely at startup. The worker is a
separate service by design; do not add alert processing back into API replicas.

## Useful commands

```sh
# Run in the foreground
docker compose up --build

# Run in the background
docker compose up --build -d

# Inspect status and logs
docker compose ps
docker compose logs -f backend
docker compose logs -f alert-worker

# Stop the stack while preserving the database volume
docker compose down
```

`docker compose down -v` deletes the local development database volume. Use it
only when a clean database is intended.

## Validate the stack

```sh
curl http://localhost:8080/health
cd backend && go test ./...
```

For a real parked-car alert test, use an Expo-enabled device, set
`EXPO_PUSH_ACCESS_TOKEN`, start a parking session, and submit a nearby
enforcement report from another account. See [API testing](API_TESTING.md).

## Production note

`docker-compose.prod.yml` is a container definition, not a complete public
production deployment. It does not include TLS termination, external
monitoring, or a real-device push-release verification. For the encrypted
off-host backup and restore-drill workflow, see [self-hosting](SELF_HOSTING.md)
and [deployment requirements](DOCKER_DEPLOYMENT.md).
