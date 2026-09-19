#!/usr/bin/env bash

# Restores an encrypted backup into a new disposable PostGIS database on the
# same private server. It never targets parkopticon_db, so routine restore
# drills cannot overwrite the live application database.

set -Eeuo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
backend_dir="$(cd "$script_dir/.." && pwd)"
compose_file="${COMPOSE_FILE:-$backend_dir/docker-compose.prod.yml}"
env_file="${ENV_FILE:-$backend_dir/.env.prod}"
db_user="${DB_USER:-parkopticon}"
production_db="${DB_NAME:-parkopticon_db}"
archive=""
identity_file="${AGE_IDENTITY_FILE:-}"
target_db=""

usage() {
  cat <<'EOF'
Usage: restore-drill.sh --file /absolute/path/parkopticon_YYYYMMDDTHHMMSSZ.dump.age \
  --identity /secure/path/age-identity.txt [--target-db parkopticon_restore_YYYYMMDD]

Creates a new disposable PostGIS database and restores the archive there. It
will never restore over parkopticon_db.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --file)
      archive="${2:-}"
      shift 2
      ;;
    --identity)
      identity_file="${2:-}"
      shift 2
      ;;
    --target-db)
      target_db="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      usage >&2
      exit 2
      ;;
  esac
done

fail() {
  echo "restore drill failed: $*" >&2
  exit 1
}

[[ "$archive" == /* && -f "$archive" ]] || fail "--file must name an existing absolute archive path"
[[ "$identity_file" == /* && -f "$identity_file" ]] || fail "--identity must name an existing absolute age identity file"
[[ -f "$compose_file" ]] || fail "Compose file not found: $compose_file"
[[ -f "$env_file" ]] || fail "Environment file not found: $env_file"
command -v docker >/dev/null 2>&1 || fail "docker is required"
command -v age >/dev/null 2>&1 || fail "age is required to decrypt backups"

target_db="${target_db:-parkopticon_restore_$(date -u +%Y%m%d%H%M%S)}"
[[ "$target_db" =~ ^parkopticon_restore_[a-zA-Z0-9_]+$ ]] || fail "target database must use the parkopticon_restore_ prefix"
[[ "$target_db" != "$production_db" ]] || fail "a restore drill must never target the production database"

compose=(docker compose --env-file "$env_file" -f "$compose_file")
if [[ -f "${archive}.sha256" ]]; then
  (cd "$(dirname "$archive")" && sha256sum --check "$(basename "${archive}.sha256")")
fi

if "${compose[@]}" exec -T postgres psql -U "$db_user" -d postgres -Atqc "SELECT 1 FROM pg_database WHERE datname = '$target_db'" | grep -qx '1'; then
  fail "target database already exists: $target_db"
fi

echo "Creating disposable restore target: $target_db"
"${compose[@]}" exec -T postgres createdb -U "$db_user" -T template_postgis "$target_db"

echo "Restoring encrypted archive into $target_db"
age -d -i "$identity_file" "$archive" | \
  "${compose[@]}" exec -T postgres \
    pg_restore -U "$db_user" -d "$target_db" \
    --no-owner --no-privileges --exit-on-error

"${compose[@]}" exec -T postgres psql -U "$db_user" -d "$target_db" -v ON_ERROR_STOP=1 <<'SQL'
ANALYZE;
SELECT extname FROM pg_extension WHERE extname IN ('postgis', 'pgcrypto') ORDER BY extname;
SELECT COUNT(*) AS migration_count FROM schema_migrations;
SQL

echo "Restore drill complete: $target_db"
echo "Inspect it, record recovery time, then remove it manually when the drill is accepted:"
echo "  ${compose[*]} exec postgres dropdb -U $db_user $target_db"
