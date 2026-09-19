# Self-hosting Park Opticon

This deployment keeps PostgreSQL + PostGIS private to the Docker network and
exposes the Go API only through a host TLS reverse proxy. It is a good fit for
an early deployment if the team accepts responsibility for operating the
database.

## Server layout

1. Use a supported Linux host with Docker Engine and Docker Compose v2.
2. Keep `/opt/parkopticon/postgres_data` on durable encrypted storage.
3. Put Nginx, Caddy, or another trusted TLS proxy in front of the API. The
   production Compose file binds the API to `127.0.0.1:8080` by default; do not
   expose that port directly.
4. Populate `backend/.env.prod` with strong secrets, exact CORS origins, the
   OAuth values from [social sign-in setup](../setup/SOCIAL_SIGN_IN.md), and a
   narrow `TRUSTED_PROXIES` value for the reverse proxy.

The bundled database is not published to the host. It uses
`DB_SSLMODE=disable` only on the private same-host Compose network, with an
explicit `DB_ALLOW_INSECURE_LOCAL=true` opt-in. For a remote database, set
`DB_SSLMODE=verify-full`, provide `DB_SSLROOTCERT`, and leave the opt-in false.

## Backups

### Interim local backups on the development host

The development Compose stack publishes PostgreSQL only on
`127.0.0.1:5432`; containers continue to use `postgres:5432` internally.

`backend/scripts/backup-local-db.sh` provides a separate local-only backup
option while off-host storage is being arranged. It saves PostgreSQL custom
archives and checksums to `/opt/parkopticon/backups`, restricts the directory
to its owner, validates each archive, and retains roughly 14 days of backups.
These archives are **not encrypted** and remain on the database host. They
do not satisfy the off-host backup requirement for production deployments.

The units in `backend/systemd/` run this script daily at 02:30 UTC and catch
up after downtime. Install the script at
`/usr/local/libexec/parkopticon/backup-local-db.sh` with mode `0700`, install
the units in `/etc/systemd/system/`, then run:

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now parkopticon-local-backup.timer
sudo systemctl start parkopticon-local-backup.service
sudo systemctl status parkopticon-local-backup.timer
sudo journalctl -u parkopticon-local-backup.service
```

A failed backup is recorded as a failed systemd service; external failure
notifications are not configured by these units.

### Encrypted off-host backups for production

Install [`age`](https://age-encryption.org/) on the host, create an age
recipient whose private identity is stored **outside** the database host, and
make separate local and off-host destinations. The off-host destination can be
an encrypted mounted volume, object-storage gateway, or another host; it must
not be another directory on the same disk.

```sh
sudo apt-get update && sudo apt-get install -y age
```

Create `/etc/parkopticon/backup.env` with mode `0600`:

```dotenv
BACKUP_DIR=/opt/parkopticon/backups
BACKUP_OFFSITE_DIR=/mnt/offsite/parkopticon
BACKUP_AGE_RECIPIENT=age1replace_with_the_off_host_public_recipient
BACKUP_RETENTION_DAYS=30
```

Then create the backup directory with owner-only permissions and run a backup:

```sh
sudo install -d -m 700 /opt/parkopticon/backups
sudo -i
set -a; . /etc/parkopticon/backup.env; set +a
cd /opt/parkopticon/Park-Opticon/backend
./scripts/backup-db.sh
```

The script validates the PostgreSQL custom archive, encrypts it with `age`,
creates a checksum, and only publishes the archive after its encrypted off-host
copy has the same checksum. Keeping only the mounted Docker volume and local
archives does not protect against host loss or ransomware.

Schedule it, for example, at 02:30 UTC:

```cron
30 2 * * * cd /opt/parkopticon/Park-Opticon/backend && set -a && . /etc/parkopticon/backup.env && set +a && ./scripts/backup-db.sh >> /var/log/parkopticon-backup.log 2>&1
```

## Restore drills

At least monthly, restore an archive into a disposable PostGIS database on the
server (or, preferably, an isolated recovery host). The private age identity is
needed only for the drill; do not store it alongside the database:

```sh
cd /opt/parkopticon/Park-Opticon/backend
./scripts/restore-drill.sh \
  --file /absolute/path/parkopticon_YYYYMMDDTHHMMSSZ.dump.age \
  --identity /secure/temporary/path/age-identity.txt
```

The restore drill never targets `parkopticon_db`; it creates a disposable
`parkopticon_restore_*` database, restores the dump, runs `ANALYZE`, and checks
PostGIS, pgcrypto, and migration history. Record recovery time and verify the
API/mobile smoke flow against the recovered data before considering a real
disaster-recovery procedure.

## Deployment

`./deploy.sh` requires `/etc/parkopticon/backup.env`, creates and verifies an
encrypted off-host backup before migration, builds a revision-tagged backend
image, and recreates only the API and worker. It leaves PostgreSQL running,
avoiding an unnecessary database outage. The server starts migrations
transactionally before accepting application traffic.

## Remaining production hardening

- The `POSTGRES_USER` role bootstraps the cluster and is therefore privileged.
  Before a public launch, split it into a one-shot migration/owner role and a
  least-privilege API/worker role; migrations currently run at API startup.
- Make `/opt/parkopticon/postgres_data` host-disk encrypted, owned by the
  Postgres container UID/GID, and mode `0700`.
- Keep `.env.prod` mode `0600`, and use a deployment secret store when one is
  available. Docker-capable host users can otherwise read container secrets.
