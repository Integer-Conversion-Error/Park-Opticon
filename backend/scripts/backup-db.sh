#!/usr/bin/env bash

# Creates an encrypted PostgreSQL/PostGIS archive from the private production
# Compose database and atomically copies it to a separately mounted off-host
# destination. The host needs only an age *recipient* public key; keep the
# corresponding private identity off this server.

set -Eeuo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
backend_dir="$(cd "$script_dir/.." && pwd)"
compose_file="${COMPOSE_FILE:-$backend_dir/docker-compose.prod.yml}"
env_file="${ENV_FILE:-$backend_dir/.env.prod}"
backup_dir="${BACKUP_DIR:-/opt/parkopticon/backups}"
offsite_dir="${BACKUP_OFFSITE_DIR:-}"
age_recipient="${BACKUP_AGE_RECIPIENT:-}"
retention_days="${BACKUP_RETENTION_DAYS:-14}"
db_user="${DB_USER:-parkopticon}"
db_name="${DB_NAME:-parkopticon_db}"

fail() {
  echo "backup failed: $*" >&2
  exit 1
}

[[ -f "$compose_file" ]] || fail "Compose file not found: $compose_file"
[[ -f "$env_file" ]] || fail "Environment file not found: $env_file"
[[ "$backup_dir" == /* && "$backup_dir" != "/" ]] || fail "BACKUP_DIR must be an absolute directory other than /"
[[ "$offsite_dir" == /* && "$offsite_dir" != "/" ]] || fail "BACKUP_OFFSITE_DIR must be an absolute directory other than /"
[[ -n "$age_recipient" ]] || fail "BACKUP_AGE_RECIPIENT is required"
[[ "$retention_days" =~ ^[1-9][0-9]*$ ]] || fail "BACKUP_RETENTION_DAYS must be a positive integer"
command -v docker >/dev/null 2>&1 || fail "docker is required"
command -v age >/dev/null 2>&1 || fail "age is required to encrypt backups"

umask 077
mkdir -p "$backup_dir"
mkdir -p "$offsite_dir"
backup_dir="$(realpath -m "$backup_dir")"
offsite_dir="$(realpath -m "$offsite_dir")"
[[ "$backup_dir" != "$offsite_dir" ]] || fail "BACKUP_DIR and BACKUP_OFFSITE_DIR must be different failure domains"

compose=(docker compose --env-file "$env_file" -f "$compose_file")
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
archive_name="parkopticon_${timestamp}.dump.age"
archive="$backup_dir/$archive_name"
temporary_dump="$backup_dir/parkopticon_${timestamp}.dump.partial"
temporary_archive="${archive}.partial"
offsite_archive="$offsite_dir/$archive_name"
offsite_temporary="${offsite_archive}.partial"

echo "Creating PostgreSQL archive: $archive_name"
"${compose[@]}" exec -T postgres \
  pg_dump -U "$db_user" -d "$db_name" \
  --format=custom --no-owner --no-privileges > "$temporary_dump"

# Validate that pg_restore can parse the completed custom archive before
# publishing it as a successful backup.
"${compose[@]}" exec -T postgres pg_restore --list < "$temporary_dump" >/dev/null

age -r "$age_recipient" -o "$temporary_archive" "$temporary_dump"
rm -f "$temporary_dump"

mv "$temporary_archive" "$archive"
sha256sum "$archive" > "${archive}.sha256"

# Copy first to a distinct temporary name, verify the encrypted payload, then
# publish. A mounted object-store gateway or another host's encrypted volume is
# suitable for BACKUP_OFFSITE_DIR; it must not be another path on the same disk.
cp "$archive" "$offsite_temporary"
cp "${archive}.sha256" "${offsite_temporary}.sha256"
local_hash="$(sha256sum "$archive" | awk '{print $1}')"
remote_hash="$(sha256sum "$offsite_temporary" | awk '{print $1}')"
[[ "$local_hash" == "$remote_hash" ]] || fail "off-host backup checksum does not match local archive"
mv "$offsite_temporary" "$offsite_archive"
mv "${offsite_temporary}.sha256" "${offsite_archive}.sha256"

find "$backup_dir" -mindepth 1 -maxdepth 1 -type f \
  \( -name 'parkopticon_*.dump.age' -o -name 'parkopticon_*.dump.age.sha256' \) \
  -mtime +"$retention_days" -print -delete
find "$offsite_dir" -mindepth 1 -maxdepth 1 -type f \
  \( -name 'parkopticon_*.dump.age' -o -name 'parkopticon_*.dump.age.sha256' \) \
  -mtime +"$retention_days" -print -delete

echo "Backup complete: $archive"
echo "Verified encrypted off-host copy: $offsite_archive"
