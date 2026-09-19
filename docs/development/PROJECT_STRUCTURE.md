# Project structure

**Current as of 2026-08-25.** Source code is the authority; this page is a
map of the active repository structure.

```text
admin-portal/
  src/
    api/             Axios API client
    components/      Layout, map, MFA components
    pages/           Dashboard, users, spots, templates, map, analytics

backend/
  cmd/server/        Go HTTP API entry point
  cmd/worker/        Alert + expiry worker entry point
  internal/
    handlers/        HTTP handlers
    middleware/      Auth, security, audit, errors
    database/        Connection pool and runtime migrations
    notifications/  Expo push client
    worker/          Durable alert dispatcher and expiry worker
  migrations/        Fresh-database SQL bootstrap path

parkopticon/
  src/
    navigation/      Auth and tab navigation
    screens/         Auth, map, enforcement report, profile, settings
    services/        API, location, secure storage, push registration, guest mode
    components/      Shared React Native UI
    theme/           Colors, spacing, typography
  assets/            App icon, splash, favicon, adaptive icon

docs/
  backend/           Maintained backend/operator guides
  admin-portal/      Maintained portal guides
  setup/             Current setup instructions
  audit/             Current risk/remediation record
```

## Key boundaries

- The mobile and admin clients call the Go API; they do not connect directly to
  PostgreSQL.
- The HTTP API and the worker are independent binaries/containers.
- Runtime migrations in `backend/internal/database/migrations.go` update
  existing databases; `backend/migrations/*.sql` are only for a fresh bootstrap.
- The mobile app includes only the screens registered in
  `parkopticon/src/navigation/AppNavigator.js`. Deleted legacy demo, alerts,
  tickets, and parking-report screens are not part of the app.
- Mobile navigation has two persistent tabs: Map and Account. Settings is a
  secondary stack screen; nearby reports is an in-map bottom-half sheet; and
  enforcement reporting is a transparent modal over the map. See
  [the current mobile design reference](../design/DESIGN_QUICK_REF.md).

## Useful entry points

| Task | Location |
| --- | --- |
| Add/adjust a driver API route | `backend/internal/router/router.go` + handler |
| Change database schema | runtime migration + matching fresh SQL migration |
| Change alert matching/delivery | `backend/internal/worker/alert_dispatcher.go` |
| Change mobile API wiring | `parkopticon/src/services/api.js` |
| Change the mobile UI/navigation contract | `docs/design/DESIGN_QUICK_REF.md` + `parkopticon/src/screens/` |
| Change admin API wiring | `admin-portal/src/api/client.js` |
| Change local service topology | `backend/docker-compose.yml` |
