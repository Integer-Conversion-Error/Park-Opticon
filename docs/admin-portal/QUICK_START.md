# Admin portal quick start

```sh
# Terminal 1: database-backed API and alert worker
cd backend
docker compose up --build

# Terminal 2: portal
cd admin-portal
cp .env.example .env
# VITE_API_URL=http://localhost:8080/api/v1
npm ci
npm run dev
```

Open the Vite URL shown in the terminal (normally `http://localhost:5173`).

Sign in with a real admin account, complete MFA enrollment/verification if
prompted, and use the portal. Do not use mock credentials or mock mode to
validate production admin behavior.

Before publishing the portal:

```sh
npm run lint
npm run build
```

For known product/API gaps, read [README.md](README.md) and the
[prelaunch audit](../audit/PRELAUNCH_AUDIT.md).
