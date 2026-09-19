# Admin portal implementation notes

**Status — 2026-08-25:** this document records the current integration
boundary, not a claim that every UI control is release-ready.

## API contract

The portal expects `VITE_API_URL` to be an API base ending in `/api/v1`.
Authentication uses `/auth/login`, then the portal performs the MFA flow before
allowing the admin shell for an admin user.

The implemented backend routes cover:

- Admin user listing
- Parking spot list/create/update/delete
- Parking-spot polygon create/update/delete
- Parking templates CRUD
- Enforcement-alert listing

The frontend client contains calls for user details and statistics endpoints
that are not registered in the Go router. Dashboard/analytics output should be
treated as incomplete until those contracts are implemented and tested.

## Security constraints

- Access tokens are memory-only in the portal.
- API authorization—not client-side routing—enforces admin/MFA access.
- Use HTTPS and a production `VITE_API_URL` for deployment.

## Map/polygon notes

Polygon edits use the backend parking-spot geofence routes. The canonical
schema uses `geometry(POLYGON, 4326)`. Validate polygon editing against a real
PostGIS-backed backend; fixture/mock responses do not validate persistence.

## Validation

```sh
npm run lint
npm run build
```

Run manual checks for sign-in, MFA, listing, parking-spot mutation, polygon
editing, and logout against the configured backend.
