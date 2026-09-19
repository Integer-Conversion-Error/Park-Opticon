#!/usr/bin/env bash
# Interim, owner-only local backups. These do not replace encrypted off-host
# backups from backup-db.sh and do not protect against loss of this server.
set -Eeuo pipefail
umask 077

backup_dir="${BACKUP_DIR:-/opt/parkopticon/backups}"
container="${BACKUP_CONTAINER:-parkopticon-db}"
db_user="${DB_USER:-parkopticon}"
db_name="${DB_NAME:-parkopticon_db}"
retention_days="${BACKUP_RETENTION_DAYS:-14}"

[[ "$backup_dir" == /* && "$backup_dir" != / ]] || { echo 'Invalid backup directory' >&2; exit 1; }
[[ "$retention_days" =~ ^[1-9][0-9]*$ ]] || { echo 'Invalid retention period' >&2; exit 1; }
command -v docker >/dev/null
command -v flock >/dev/null
mkdir -p "$backup_dir"
chmod 0700 "$backup_dir"
exec 9>"$backup_dir/.backup.lock"
flock -n 9 || { echo 'Another local backup is running' >&2; exit 1; }

temporary_dir="$(mktemp -d "$backup_dir/.parkopticon-backup.XXXXXXXX")"
cleanup() {
  rm -f -- "$temporary_dir/database.dump" "$temporary_dir/checksum"
  rmdir -- "$temporary_dir"
}
trap cleanup EXIT

archive_name="parkopticon_local_$(date -u +%Y%m%dT%H%M%S%NZ).dump"
docker exec "$container" pg_dump -U "$db_user" -d "$db_name" \
  --format=custom --no-owner --no-privileges > "$temporary_dir/database.dump"
docker exec -i "$container" pg_restore --list < "$temporary_dir/database.dump" >/dev/null
digest="$(sha256sum "$temporary_dir/database.dump")"
printf '%s  %s\n' "${digest%% *}" "$archive_name" > "$temporary_dir/checksum"
mv -- "$temporary_dir/database.dump" "$backup_dir/$archive_name"
mv -- "$temporary_dir/checksum" "$backup_dir/$archive_name.sha256"
(cd "$backup_dir" && sha256sum --check "$archive_name.sha256")

# Only prune this script's archives after a fresh archive has passed validation.
find "$backup_dir" -maxdepth 1 -type f \
  \( -name 'parkopticon_local_*.dump' -o -name 'parkopticon_local_*.dump.sha256' \) \
  -mtime +"$retention_days" -print -delete
echo "Local backup complete: $backup_dir/$archive_name (not an off-host backup)"
