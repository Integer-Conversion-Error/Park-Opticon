# Park Opticon Waydroid and Maestro runner

Run from the repository root:

```sh
bash scripts/run-waydroid-maestro.sh
```

The runner uses the existing Android 13 Waydroid host and the shared
`/mnt/devdata/android-ci/waydroid-mobile-ci.lock`. If another app owns that
lock, wait for its test run to finish. Do not launch a second Maestro process,
change the device's location, replace ADB forwards, or restart Waydroid while
it is held. The script checks the secondary disk UUID, connected guest, and
dedicated ports before using the device.

## Isolation and sequence

Each run creates a private artifact directory under
`/mnt/devdata/android-ci/artifacts/parkopticon-maestro-*`. Docker Compose starts
a fresh PostGIS database and Park Opticon API. The API is published only on
host loopback at port 18080. ADB reverse exposes only that port to the guest
while this runner owns the shared lock. Accounts and
secrets are generated for this run. The script removes its database volume and
GPS test provider at exit, and it does not touch the other app's packages.

The suite runs guest storage, UI registration, signed-in parking start and end,
near and far peer-report verification, denied and inaccurate-location failures,
API interruption and recovery, and native APK configuration smoke. After UI
actions, a Node helper checks the actual API session, preferences, shared spot, report,
verification, and community impact. Recovery must create a second server spot
when the driver ends a session that began locally during the outage.
Every Maestro flow writes JUnit output and command logs; failed flows and
configured checkpoints also write screenshots. The runner copies the
source-built APK and its SHA-256 into the artifact directory.

## Android build boundary

No valid project Maps SDK key is currently available. The core journey APK is
source-built with an explicit dummy key so native map controls can mount; its
map tiles are not a visual acceptance result. A second source-built APK has no
key and checks the explicit missing-key screen. Expo Go proved unreliable for
touch interaction on this Waydroid host, so the required suite uses Park
Opticon's own native package. Once a restricted Android Maps key exists, rerun
map visual QA with a genuinely keyed native APK.

## Pass and triage

A valid pass requires exit code zero, `ci-summary.md` containing
`Overall status: **PASS**`, every named flow passing, and all fixture API
assertions succeeding. On failure, inspect that run's stage log, `backend.log`,
native build/install logs, and Maestro screenshots/command logs. Fix the app,
test data, selector, or transport problem and rerun the entire suite. Credentials belong
only in the private run directory; do not paste them into issues or chat.
