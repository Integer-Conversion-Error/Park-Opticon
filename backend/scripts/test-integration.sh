#!/usr/bin/env bash
# Run the Go suite against an isolated, disposable PostGIS container.
set -euo pipefail
cd "$(dirname "$0")/.."
container_id=$(docker run --detach --rm \
  --publish 127.0.0.1::5432 \
  --env POSTGRES_PASSWORD=spatial-tests \
  --env POSTGRES_DB=parkopticon_tests \
  postgis/postgis:15-3.4)
trap 'docker rm --force "$container_id" >/dev/null 2>&1 || true' EXIT
ready=false
for ((attempt=0; attempt<60; attempt++)); do
  if docker exec "$container_id" pg_isready -h 127.0.0.1 -U postgres -d parkopticon_tests >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 1
done
if [[ "$ready" != true ]]; then
  docker logs "$container_id"
  exit 1
fi
endpoint=$(docker port "$container_id" 5432/tcp)
export PARKOPTICON_TEST_DATABASE_URL="postgres://postgres:spatial-tests@127.0.0.1:${endpoint##*:}/parkopticon_tests?sslmode=disable"
# Existing pipeline tests consume global queue jobs; serialize packages so
# independent fixture suites cannot consume one another's jobs.
go test -p 1 ./... -count=1 "$@"
