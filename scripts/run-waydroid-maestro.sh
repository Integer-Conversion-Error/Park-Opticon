#!/usr/bin/env bash
# Full Park Opticon Android journey suite on the shared Waydroid host.
set -euo pipefail
umask 077

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_ROOT="$PROJECT_ROOT/parkopticon"
ANDROID_CI_ROOT="${ANDROID_CI_ROOT:-/mnt/devdata/android-ci}"
EXPECTED_DISK_UUID="ffb78338-6a2a-4c45-bd92-43607ccf079e"
LOCK="$ANDROID_CI_ROOT/waydroid-mobile-ci.lock"
die() { printf '[parkopticon-e2e] ERROR: %s\n' "$*" >&2; exit 1; }

[[ "$(findmnt -n -o UUID -T "$ANDROID_CI_ROOT")" == "$EXPECTED_DISK_UUID" ]] || die 'Secondary Android disk is unavailable or changed'
[[ "$(readlink -f /var/lib/waydroid)" == "$ANDROID_CI_ROOT/waydroid" ]] || die 'Waydroid data is not on the secondary disk'
if [[ "${PARKOPTICON_WAYDROID_LOCK_HELD:-0}" != 1 ]]; then
  if flock -n -E 75 -o "$LOCK" env PARKOPTICON_WAYDROID_LOCK_HELD=1 bash "$0" "$@"; then
    exit 0
  else
    status=$?
    [[ "$status" != 75 ]] || die 'Shared Waydroid runner is busy; retry after it releases the lock'
    exit "$status"
  fi
fi

for command in adb curl docker findmnt flock lsof maestro node npm npx openssl rsync timeout waydroid; do
  command -v "$command" >/dev/null || die "Missing command: $command"
done
[[ -z "$(lsof -t -iTCP:18080 -sTCP:LISTEN 2>/dev/null || true)" ]] || die 'Port 18080 is already owned by another service'
export ANDROID_HOME="$ANDROID_CI_ROOT/sdk"
export ANDROID_SDK_ROOT="$ANDROID_CI_ROOT/sdk"
export GRADLE_USER_HOME="$ANDROID_CI_ROOT/gradle"
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export TMPDIR="$ANDROID_CI_ROOT/tmp"
[[ "$(waydroid status | sed -n 's/^Session:[[:space:]]*//p')" == RUNNING ]] || die 'Waydroid session is not running'

RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)-$$"
ACCOUNT_SUFFIX="${RUN_ID,,}"
RUN_ROOT="$ANDROID_CI_ROOT/artifacts/parkopticon-maestro-$RUN_ID"
mkdir -p "$RUN_ROOT"
chmod 700 "$RUN_ROOT"
mkdir -p "$RUN_ROOT/logs" "$RUN_ROOT/maestro" "$RUN_ROOT/debug"
export PARKOPTICON_E2E_HOST_IP=127.0.0.1
export PARKOPTICON_E2E_API_URL="http://$PARKOPTICON_E2E_HOST_IP:18080"
PARKOPTICON_E2E_DB_PASSWORD="$(openssl rand -hex 24)"
PARKOPTICON_E2E_JWT_SECRET="$(openssl rand -hex 32)"
PARKOPTICON_E2E_MFA_KEY="$(openssl rand -hex 32)"
export PARKOPTICON_E2E_DRIVER_EMAIL="driver.$ACCOUNT_SUFFIX@example.invalid"
PARKOPTICON_E2E_DRIVER_PASSWORD="$(openssl rand -hex 18)"
export PARKOPTICON_E2E_PEER_EMAIL="peer.$ACCOUNT_SUFFIX@example.invalid"
PARKOPTICON_E2E_PEER_PASSWORD="$(openssl rand -hex 18)"
export PARKOPTICON_E2E_DB_PASSWORD PARKOPTICON_E2E_JWT_SECRET PARKOPTICON_E2E_MFA_KEY
export PARKOPTICON_E2E_DRIVER_PASSWORD PARKOPTICON_E2E_PEER_PASSWORD
export MAESTRO_DRIVER_EMAIL="$PARKOPTICON_E2E_DRIVER_EMAIL"
export MAESTRO_DRIVER_PASSWORD="$PARKOPTICON_E2E_DRIVER_PASSWORD"
COMPOSE_PROJECT_NAME="parkopticon_e2e_${RUN_ID//[^0-9]/_}"
export COMPOSE_PROJECT_NAME
COMPOSE_FILE="$APP_ROOT/e2e/docker-compose.yml"
GUEST_SERIAL=""
BUILD_ROOT=""
GPS_ADDED=0
MOCK_OP_CHANGED=0
MOCK_OP_ORIGINAL=default
REVERSE_API_ADDED=0
COMPOSE_STARTED=0
PASSED=0

cleanup() {
  local status=$?
  trap - EXIT
  if [[ "$PASSED" != 1 ]]; then
    printf '# Park Opticon Waydroid CI\n\nOverall status: **FAIL**\n' >"$RUN_ROOT/ci-summary.md"
  fi
  if [[ "$GPS_ADDED" == 1 && -n "$GUEST_SERIAL" ]]; then
    adb -s "$GUEST_SERIAL" shell cmd location providers remove-test-provider gps >/dev/null 2>&1 || true
  fi
  if [[ "$MOCK_OP_CHANGED" == 1 && -n "$GUEST_SERIAL" ]]; then
    adb -s "$GUEST_SERIAL" shell cmd appops set 2000 android:mock_location "$MOCK_OP_ORIGINAL" >/dev/null 2>&1 || true
  fi
  if [[ "$REVERSE_API_ADDED" == 1 && -n "$GUEST_SERIAL" ]]; then
    adb -s "$GUEST_SERIAL" reverse --remove tcp:18080 >/dev/null 2>&1 || true
  fi
  if [[ "$COMPOSE_STARTED" == 1 ]]; then
    docker compose -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT_NAME" logs --no-color >"$RUN_ROOT/backend.log" 2>&1 || true
    docker compose -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT_NAME" down --volumes >"$RUN_ROOT/compose-down.log" 2>&1 || true
  fi
  if [[ -n "$BUILD_ROOT" && "$BUILD_ROOT" == "$ANDROID_CI_ROOT/tmp/parkopticon-build-"* ]]; then
    rm -rf -- "$BUILD_ROOT"
  fi
  printf '[parkopticon-e2e] Artifacts: %s\n' "$RUN_ROOT"
  exit "$status"
}
trap cleanup EXIT

printf 'commit=%s\nworktree_dirty=%s\n' "$(git -C "$PROJECT_ROOT" rev-parse HEAD)" "$(git -C "$PROJECT_ROOT" status --porcelain | wc -l)" >"$RUN_ROOT/run-info.txt"
printf '[parkopticon-e2e] Artifacts: %s\n' "$RUN_ROOT"
GUEST_IP="$(waydroid status | sed -nE 's/^IP address:[[:space:]]*([0-9.]+)$/\1/p')"
[[ -n "$GUEST_IP" ]] || die 'Waydroid has no guest IP'
GUEST_SERIAL="$GUEST_IP:5555"
adb connect "$GUEST_SERIAL" >"$RUN_ROOT/logs/adb-connect.log"
[[ "$(adb -s "$GUEST_SERIAL" get-state)" == device ]] || die 'Waydroid ADB device is unavailable'
adb -s "$GUEST_SERIAL" reverse tcp:18080 tcp:18080 >/dev/null || die 'Could not reverse the API port'
REVERSE_API_ADDED=1
MOCK_OP_ORIGINAL="$(adb -s "$GUEST_SERIAL" shell cmd appops get 2000 android:mock_location | sed -nE 's/.*MOCK_LOCATION: ([a-z_]+).*/\1/p' | head -1)"
MOCK_OP_ORIGINAL="${MOCK_OP_ORIGINAL:-default}"
adb -s "$GUEST_SERIAL" shell cmd appops set 2000 android:mock_location allow >/dev/null || die 'Cannot grant the ADB shell mock-location AppOp'
MOCK_OP_CHANGED=1

docker compose -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT_NAME" up --build -d >"$RUN_ROOT/logs/compose-up.log" 2>&1 || die 'Disposable API startup failed'
COMPOSE_STARTED=1
for attempt in {1..60}; do
  curl -fsS --max-time 2 "$PARKOPTICON_E2E_API_URL/health" >/dev/null 2>&1 && break
  sleep 1
done
curl -fsS --max-time 2 "$PARKOPTICON_E2E_API_URL/health" >/dev/null || die 'Disposable API health check failed'
node "$APP_ROOT/e2e/fixtures.mjs" setup >"$RUN_ROOT/logs/fixture-setup.log"

export EXPO_PUBLIC_API_URL="$PARKOPTICON_E2E_API_URL"
export EXPO_PUBLIC_AUTH_TEST_MODE=0
export PARKOPTICON_LOCAL_API_HOST="$PARKOPTICON_E2E_HOST_IP"
export EAS_BUILD_PROFILE=local
BUILD_ROOT="$ANDROID_CI_ROOT/tmp/parkopticon-build-$RUN_ID"
mkdir -p "$BUILD_ROOT"

build_variant() {
  local variant=$1 destination="$RUN_ROOT/parkopticon-$1.apk"
  local source_dir="$BUILD_ROOT/$variant"
  mkdir -p "$source_dir"
  rsync -a --exclude='.env' --exclude='node_modules' --exclude='.expo' --exclude='dist' --exclude='android' \
    "$APP_ROOT/" "$source_dir/"
  (
    cd "$source_dir"
    if [[ "$variant" == core ]]; then
      export GOOGLE_MAPS_ANDROID_API_KEY=AIzaParkOpticonE2EDummyKey0000000000
    else
      unset GOOGLE_MAPS_ANDROID_API_KEY
    fi
    npm ci
    npx expo prebuild --platform android --clean --no-install
    cd android
    ./gradlew :app:assembleRelease --no-daemon -PreactNativeArchitectures=x86_64
  ) >"$RUN_ROOT/logs/native-build-$variant.log" 2>&1 || die "Native $variant APK build failed"
  local built="$source_dir/android/app/build/outputs/apk/release/app-release.apk"
  [[ -f "$built" ]] || die "Native $variant APK missing"
  cp "$built" "$destination"
  sha256sum "$destination" >"$RUN_ROOT/$variant-apk.sha256"
}

installed_apk_hash() {
  local installed_path
  installed_path="$(timeout 10 adb -s "$GUEST_SERIAL" shell pm path com.parkopticon.app 2>/dev/null | sed -n 's/^package://p' | head -1 || true)"
  [[ -n "$installed_path" ]] || return 1
  timeout 10 adb -s "$GUEST_SERIAL" shell sha256sum "$installed_path" 2>/dev/null | awk '{print $1}'
}

install_apk_verified() {
  local apk=$1 label=$2 expected current guest_apk
  expected="$(sha256sum "$apk" | awk '{print $1}')"
  current="$(installed_apk_hash || true)"
  if [[ "$current" == "$expected" ]]; then
    printf 'Reusing exact installed APK: %s\n' "$expected" >"$RUN_ROOT/logs/native-install-$label.log"
    return 0
  fi
  guest_apk="/data/local/tmp/parkopticon-$label-$RUN_ID.apk"
  timeout 60 adb -s "$GUEST_SERIAL" push "$apk" "$guest_apk" >"$RUN_ROOT/logs/native-install-$label.log" 2>&1 || die "Could not copy the $label APK to Waydroid"
  timeout 180 adb -s "$GUEST_SERIAL" shell cmd package install -r "$guest_apk" >>"$RUN_ROOT/logs/native-install-$label.log" 2>&1 || die "Android rejected the $label APK"
  adb -s "$GUEST_SERIAL" shell rm "$guest_apk" >/dev/null 2>&1 || true
  current="$(installed_apk_hash || true)"
  [[ "$current" == "$expected" ]] || die "Installed $label APK hash does not match the source build"
  timeout 30 adb -s "$GUEST_SERIAL" shell pm clear com.parkopticon.app >"$RUN_ROOT/logs/native-clear-$label.log" 2>&1 || die "Android package manager did not finish the $label install"
}

CORE_APK="$RUN_ROOT/parkopticon-core.apk"
if [[ -n "${PARKOPTICON_E2E_CORE_APK_PATH:-}" ]]; then
  [[ -f "$PARKOPTICON_E2E_CORE_APK_PATH" ]] || die 'Provided core APK does not exist'
  cp "$PARKOPTICON_E2E_CORE_APK_PATH" "$CORE_APK"
  sha256sum "$CORE_APK" >"$RUN_ROOT/core-apk.sha256"
else
  build_variant core
fi
install_apk_verified "$CORE_APK" core

set_location() {
  local latitude=$1 longitude=$2 accuracy=$3
  if [[ "$GPS_ADDED" == 0 ]]; then
    adb -s "$GUEST_SERIAL" shell cmd location providers add-test-provider gps >/dev/null || die 'Cannot create isolated GPS test provider'
    GPS_ADDED=1
    adb -s "$GUEST_SERIAL" shell cmd location providers set-test-provider-enabled gps true >/dev/null
  fi
  adb -s "$GUEST_SERIAL" shell cmd location providers set-test-provider-location gps --location "$latitude,$longitude" --accuracy "$accuracy" >/dev/null || die 'Cannot set test GPS location'
}

run_flow() {
  local name=$1
  local file="$APP_ROOT/e2e/maestro/$name.yaml"
  timeout 300 maestro test --udid "$GUEST_SERIAL" --format junit --output "$RUN_ROOT/$name.xml" \
    --test-output-dir "$RUN_ROOT/maestro/$name" --debug-output "$RUN_ROOT/debug/$name" \
    "$file" >"$RUN_ROOT/logs/$name.log" 2>&1 || die "Maestro flow $name failed; see $RUN_ROOT/logs/$name.log"
  printf '%s PASS\n' "$name" >>"$RUN_ROOT/stages.txt"
}

set_location 43.642567 -79.387054 5
run_flow 01_guest_local
run_flow 02_register
node "$APP_ROOT/e2e/fixtures.mjs" assert-driver >"$RUN_ROOT/logs/assert-driver.log"
run_flow 03_park_start
node "$APP_ROOT/e2e/fixtures.mjs" assert-active >"$RUN_ROOT/logs/assert-active.log"
run_flow 04_park_end
node "$APP_ROOT/e2e/fixtures.mjs" assert-ended >"$RUN_ROOT/logs/assert-ended.log"
set_location 43.700001 -79.400001 5
MAESTRO_PEER_ALERT_ID="$(node "$APP_ROOT/e2e/fixtures.mjs" seed-peer-alert)"
export MAESTRO_PEER_ALERT_ID
[[ -n "$MAESTRO_PEER_ALERT_ID" ]] || die 'Peer alert was not seeded'
PARKOPTICON_E2E_FAR_ALERT_ID="$(node "$APP_ROOT/e2e/fixtures.mjs" seed-far-alert)"
export PARKOPTICON_E2E_FAR_ALERT_ID
export MAESTRO_FAR_ALERT_ID="$PARKOPTICON_E2E_FAR_ALERT_ID"
[[ -n "$MAESTRO_FAR_ALERT_ID" ]] || die 'Far alert was not seeded'
run_flow 05_report_verify
node "$APP_ROOT/e2e/fixtures.mjs" assert-report-and-verification >"$RUN_ROOT/logs/assert-report.log"
set_location 43.700001 -79.400001 80
run_flow 06_inaccurate_location
set_location 43.642567 -79.387054 5
run_flow 11_location_denied
run_flow 08_offline_prepare
docker compose -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT_NAME" stop api >"$RUN_ROOT/logs/api-stop.log" 2>&1 || die 'Could not interrupt disposable API'
run_flow 09_offline_park
docker compose -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT_NAME" start api >"$RUN_ROOT/logs/api-restart.log" 2>&1 || die 'Could not restart disposable API'
for ((attempt=0; attempt<30; attempt++)); do
  curl -fsS --max-time 2 "$PARKOPTICON_E2E_API_URL/health" >/dev/null 2>&1 && break
  sleep 1
done
curl -fsS --max-time 2 "$PARKOPTICON_E2E_API_URL/health" >/dev/null || die 'Disposable API did not recover'
adb -s "$GUEST_SERIAL" reverse tcp:18080 tcp:18080 >/dev/null || die 'Could not restore API reverse port after restart'
timeout 15 adb -s "$GUEST_SERIAL" shell curl -fsS --max-time 5 "$PARKOPTICON_E2E_API_URL/health" \
  >"$RUN_ROOT/logs/guest-api-recovery.log" 2>&1 || die 'Waydroid guest cannot reach the recovered API'
run_flow 10_offline_finish
node "$APP_ROOT/e2e/fixtures.mjs" assert-no-active >"$RUN_ROOT/logs/assert-offline.log"

build_variant config
install_apk_verified "$RUN_ROOT/parkopticon-config.apk" config
run_flow 07_native_config

printf '# Park Opticon Waydroid CI\n\nOverall status: **PASS**\n\n' >"$RUN_ROOT/ci-summary.md"
cat "$RUN_ROOT/stages.txt" >>"$RUN_ROOT/ci-summary.md"
PASSED=1
