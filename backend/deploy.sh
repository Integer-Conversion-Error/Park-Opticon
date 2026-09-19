#!/bin/bash
# Deployment script for Park-Opticon backend
# Place this on your Ubuntu server at /opt/parkopticon/deploy.sh

set -Eeuo pipefail

echo "🚀 Starting Park-Opticon deployment..."

# Configuration
PROJECT_DIR="/opt/parkopticon/Park-Opticon/backend"
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.prod"
BACKUP_ENV_FILE="${BACKUP_ENV_FILE:-/etc/parkopticon/backup.env}"

# Navigate to project directory
cd "$PROJECT_DIR"

# Use Compose v2 consistently so deployment, backups, and runtime commands use
# the same project/network names and environment values.
compose=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")

# Pull latest code
echo "📥 Pulling latest code from GitHub..."
git pull origin main

echo "✅ Code updated successfully"

# Build the current revision under an immutable local tag as well as `latest`.
# The explicit tag is exported to Compose for this deployment and can be used
# to roll back before old images are pruned.
revision="$(git rev-parse --short=12 HEAD)"
backend_image="parkopticon/backend:${revision}"
echo "🔨 Building new backend image..."
docker build --pull --tag "$backend_image" --tag parkopticon/backend:latest .
export BACKEND_IMAGE="$backend_image"

# Ensure the private database is available before taking a fresh logical
# backup. The database container and its mounted volume are intentionally not
# torn down during normal application deployment.
echo "▶️  Ensuring PostgreSQL is running..."
"${compose[@]}" up -d postgres

echo "⏳ Waiting for PostgreSQL..."
postgres_id="$("${compose[@]}" ps -q postgres)"
for _ in $(seq 1 30); do
    postgres_health="$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$postgres_id" 2>/dev/null || true)"
    if [ "$postgres_health" = "healthy" ]; then
        break
    fi
    sleep 2
done
if [ "${postgres_health:-}" != "healthy" ]; then
    echo "❌ PostgreSQL did not become healthy"
    "${compose[@]}" logs --tail=80 postgres
    exit 1
fi

echo "💾 Creating pre-deploy database backup..."
if [ ! -f "$BACKUP_ENV_FILE" ]; then
    echo "❌ Backup configuration not found: $BACKUP_ENV_FILE"
    echo "   Configure encrypted off-host backups before deploying. See docs/backend/SELF_HOSTING.md."
    exit 1
fi
set -a
. "$BACKUP_ENV_FILE"
set +a
COMPOSE_FILE="$PROJECT_DIR/$COMPOSE_FILE" ENV_FILE="$PROJECT_DIR/$ENV_FILE" ./scripts/backup-db.sh

# Recreate only processes that run application code. This lets the API apply
# its transactional migrations without disrupting PostgreSQL or its volume.
echo "▶️  Starting API and alert worker..."
"${compose[@]}" up -d --wait --wait-timeout 90 --no-deps --force-recreate backend alert-worker

echo "🏥 Checking service health..."
backend_health="$(docker inspect --format='{{.State.Health.Status}}' parkopticon-backend-prod 2>/dev/null || true)"
worker_running="$(docker inspect --format='{{.State.Running}}' parkopticon-alert-worker-prod 2>/dev/null || true)"

if [ "$backend_health" == "healthy" ] && [ "$worker_running" == "true" ]; then
    echo "✅ Deployment successful!"
    echo ""
    echo "📊 Container status:"
    "${compose[@]}" ps
    echo ""
    echo "🌐 Backend is listening on the configured private API_BIND_ADDRESS; verify health through the HTTPS reverse proxy."
else
    echo "❌ Deployment failed - service unhealthy"
    echo ""
    echo "📋 Logs:"
    "${compose[@]}" logs --tail=50 backend
    "${compose[@]}" logs --tail=50 alert-worker
    exit 1
fi

echo ""
echo "✨ Deployment complete!"
date
