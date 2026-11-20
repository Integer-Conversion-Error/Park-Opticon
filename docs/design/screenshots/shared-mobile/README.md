# Shared mobile design: native validation

These are screenshots from the running React Native app, not the HTML concept.
The baseline is `1cb9406`; the redesign is on `codex/shared-mobile-redesign`.
The device is an isolated Android 16 / API 36 emulator at 1080 × 2400, 420 dpi.

## Before and after

| State | Before | After |
| --- | --- | --- |
| Map, guest, light, gesture navigation | [Before](before/map-android-light.png) | [After](after/map-android-gesture-light.png) |
| Report enforcement, light, gesture navigation | [Before](before/report-android-light.png) | [After: Chalking selected](after/report-selected-android-gesture-light.png) |
| Account, guest, light, gesture navigation | [Before](before/account-android-light.png) | [After](after/account-android-gesture-light.png) |
| Settings, light, gesture navigation | [Before](before/settings-android-light.png) | [After](after/settings-android-gesture-light.png) |

Additional captures in `after/` cover saved-report selection and verification,
dark appearance, Android three-button navigation, and 1.3× system text.
Reports were created through the app in guest mode and remained local.

| Additional state | Screenshot |
| --- | --- |
| Account, dark appearance | [Dark Account](after/account-android-gesture-dark.png) |
| Report sheet, three-button navigation | [Three-button navigation](after/report-android-buttons-light.png) |
| Report sheet, 1.3× text | [Larger text](after/report-android-gesture-large-text.png) |
| Saved reports list | [Saved reports](after/nearby-android-gesture-light.png) |
| Selected report confirmed | [Verification](after/verified-android-gesture-light.png) |

## Verification

- 62 unit tests and 36 component tests pass; mobile service coverage clears the
  repository's thresholds (86.36% lines, 76.68% branches).
- Android and iOS production JavaScript exports succeed.
- Expo Doctor passes all 18 checks.
- The app's own Android debug APK builds and installs. Native checks exercise
  parking, open-spot sharing, enforcement reporting, saved reports, verification,
  Settings persistence, and Android back navigation.
- The floating tabs, action cards, and sheets account for the system bottom
  inset. Settings switches have native touch bounds of at least 44 dp.

## Verification limits

The available Google Maps key does not authorize this emulator's debug signing
certificate. Native map controls and attribution mount, but map tiles are absent
in both baseline and redesigned screenshots. Map geography, dark map styling,
and exact marker placement still need a check on an authorized build. No cloud
key restrictions were changed.

No iOS device or simulator is available on this Linux host, so iOS validation is
limited to the export and shared component behavior. No production API was used;
signed-in server and provider-linking flows were reviewed in code rather than
exercised against a live account during this visual QA.
