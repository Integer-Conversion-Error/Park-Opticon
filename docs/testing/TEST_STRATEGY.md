# Mobile and driver API test strategy

The release gate covers the React Native driver app and the Go routes it uses. It
also checks the alert worker and rejects driver access to admin endpoints. The
admin portal and admin-only CRUD behavior have a separate product boundary.

## Test layers

| Layer | Behavior and evidence | Command |
| --- | --- | --- |
| Pure mobile logic | Geometry, radius limits, Maps/build configuration, API refresh single-flight, Google native-module guard | `cd parkopticon && npm run test:unit` |
| Native-bound mobile logic and components | Persistence, secure cleanup, location fallback, push failures, API errors, auth form, settings, 50 m report gate | `cd parkopticon && npm run test:components:coverage` |
| Driver HTTP and PostGIS | Real router, auth and ownership, preferences, parking, reports, feed, verification, notifications, OAuth contracts with fake identities | `cd backend && bash scripts/test-integration.sh -coverpkg=./internal/... -coverprofile=/tmp/parkopticon-cover.out` |
| Alert worker | Spatial fan-out, idempotency, provider results, retries, expiry, private-data cleanup | Included in the PostGIS command |
| Android journey | Guest and signed-in UI actions followed by API state assertions; native APK configuration smoke | `bash scripts/run-waydroid-maestro.sh` |

The Node and Jest coverage reports are separate because Node's built-in report
only includes source modules loaded by its tests. Jest explicitly collects the
native-bound service files and enforces **80% lines and 70% branches**. The Go
gate instruments cross-package calls and checks the selected driver and worker
files against **70% statements**. The route and journey matrix below remains a
gate even when numeric coverage passes.

## Critical behavior matrix

| Area | Unit/component | HTTP/worker | Android journey |
| --- | --- | --- | --- |
| Email auth and session | Form validation, missing API, refresh sharing and failure | Register/login, refresh rotation and reuse, logout, cross-account protection | Register, sign in, account access |
| Guest and storage | Guest state, malformed storage, voting, secure sign-out | No guest token reaches API | Local parking/report persistence after relaunch |
| Location and maps | Fresh/current/stale fixes, denied permission, coordinate math, key guard | Radius, sort, expiry and privacy | Accurate and inaccurate report attempts; native missing-key screen |
| Parking | Session reconciliation and settings controls | One active session, owner-only end, open-spot share, feedback and taken state | Park, restore, unpark, share, and recover a local session after an API outage |
| Enforcement | Type choice, generic failure, 50 m gate | Create, resolve, merge, near/far verification and vote replacement | Ticketing, chalking, nearby detail and confirmation |
| Alerts | Permission/provider failure | Outbox, fan-out, deduplication, retry, expiry, private notifications | Signed-in report and API postconditions |

Provider calls are controlled at the boundary: mobile native modules are
mocked, Google/Apple identity assertions use fake verifiers, and worker tests
use a fake Expo sender. No production account, database, or push provider is a
test dependency. Live provider smoke has its own [follow-up issue](https://github.com/Integer-Conversion-Error/Park-Opticon/issues/1).

## CI and result rules

GitHub-hosted CI runs Node, Jest, disposable PostGIS, `go vet`, and coverage on
pushes and pull requests. The PostGIS suite uses a fresh Docker database and
serial package execution because worker tests consume shared queue rows. The
repository currently has no self-hosted GitHub runner; Waydroid is a local
gate guarded by the host's shared lock.

Each stage must finish with exit code zero. Any failed assertion, missing
fixture, busy host, or missing artifact is a failure or a pending gate, never a
skip reported as a pass. After mobile UI/navigation changes, also run the
Android Expo export and Expo Doctor commands required by `AGENTS.md`.
