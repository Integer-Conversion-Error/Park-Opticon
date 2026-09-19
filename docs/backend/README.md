# Backend documentation

This directory contains the backend-focused documentation. The maintained
entry points are:

- [Runtime/backend README](../../backend/README.md)
- [Architecture](ARCHITECTURE.md)
- [API and testing](API_TESTING.md)
- [Docker quick start](QUICKSTART_DOCKER.md)
- [Deployment requirements](DOCKER_DEPLOYMENT.md)

## Historical files in this directory

`BACKEND_COMPLETE.md`, `DOCKER_SETUP_COMPLETE.md`, and `SETUP_COMPLETE.md`
are retained milestone snapshots. They do not describe the current worker
topology, endpoint set, push provider, or production readiness. Their headers
identify them as historical references.

`MOCK_MODE_GUIDE.md` describes the fixture-only mock server. It is useful for
basic frontend development but not for validating the database-backed API or
event-driven alerting.
