# Park Opticon documentation

This page is the documentation entry point. The repository contains several
older planning, design, and setup snapshots; they are retained for context but
are not current operating instructions.

## Maintained guides

| Need | Guide |
| --- | --- |
| Project overview and local startup | [Root README](../README.md) |
| Backend API, worker, and alert design | [Backend architecture](backend/ARCHITECTURE.md) |
| Backend endpoints and test workflow | [API testing](backend/API_TESTING.md) |
| Docker development and deployment limits | [Docker quick start](backend/QUICKSTART_DOCKER.md) |
| Backend runtime configuration | [Backend README](../backend/README.md) |
| Database migration rules | [Migration README](../backend/migrations/README.md) |
| Admin-portal setup and current capabilities | [Admin portal README](admin-portal/README.md) |
| Current mobile UI and interaction contract | [Mobile design reference](design/DESIGN_QUICK_REF.md) |
| Current-state and release risks | [Prelaunch audit](audit/PRELAUNCH_AUDIT.md) |

## Current product scope

- The mobile MVP comprises authentication, map, reports, parking-session,
  profile, and settings screens. Removed legacy demo/alerts/tickets screens
  are not part of the application.
- The Go backend owns authorization and uses PostgreSQL + PostGIS. The mobile
  client does not access database tables directly.
- Parked-car alerts are event-driven. The API writes durable jobs and an
  independent worker handles spatial matching and push delivery.
- The admin portal is a real API client, but several UI/analytics features are
  still incomplete or depend on backend endpoints that do not exist. Consult
  the audit before treating it as release-ready.

## Reference material

### Design and planning

[DESIGN_QUICK_REF.md](design/DESIGN_QUICK_REF.md) is the maintained contract
for the current mobile UI. The other files under `design/` and
`development/ROADMAP.md` are design/planning references, not a contract for
the currently shipped screens or features.

### Historical setup and implementation snapshots

Most files under `project/`, the `*_COMPLETE.md` backend files, and
`setup/MY_PROGRESS.md` describe prior milestones. Each now has a status note
pointing back here. Do not rely on their commands, file lists, feature claims,
or deployment assertions without checking the maintained guides above.

## Documentation conventions

- Source code and runtime migrations are the authority for behavior.
- A document marked **Historical reference** is retained intentionally, but
  its implementation claims may no longer apply.
- Production readiness claims require the real-device, provider, HTTPS,
  backup, monitoring, and release checks listed in the prelaunch audit.
