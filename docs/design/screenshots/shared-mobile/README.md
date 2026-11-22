# Shared mobile design: native validation

These are screenshots from the running React Native app, not the HTML concept.
The baseline is `1cb9406`; the redesign is on `codex/shared-mobile-redesign`.
The device is an isolated Android 16 / API 36 emulator at 1080 × 2400, 420 dpi.

## Before and after

| State | Before | After |
| --- | --- | --- |
| Map, guest, light, gesture navigation | [Before](before/map-android-light.png) | [After](after/map-android-gesture-light.png) |
| Report enforcement, light, gesture navigation | [Before](before/report-android-light.png) | [After: Ticketing selected](after/report-selected-android-gesture-light.png) |
| Account, guest, light, gesture navigation | [Before](before/account-android-light.png) | [After](after/account-android-gesture-light.png) |
| Settings, light, gesture navigation | [Before](before/settings-android-light.png) | [After](after/settings-android-gesture-light.png) |

Additional captures in `after/` cover saved-report selection and verification,
dark appearance, Android three-button navigation, and 1.3× system text.
Reports were created through the app in guest mode and remained local.

| Additional state | Screenshot |
| --- | --- |
| Account, dark appearance | [Dark Account](after/account-android-gesture-dark.png) |
| Map and report markers, dark appearance | [Dark map](after/map-android-gesture-dark.png) |
| Report sheet, dark appearance | [Dark report sheet](after/report-android-gesture-dark.png) |
| Report sheet, three-button navigation | [Three-button navigation](after/report-android-buttons-light.png) |
| Report sheet, 1.3× text, three-button navigation | [Larger text](after/report-android-buttons-large-text.png) |
| Saved reports list | [Saved reports](after/nearby-android-gesture-light.png) |
| Selected report confirmed | [Verification](after/verified-android-gesture-light.png) |

## Native map repairs

An authorized Maps build exposed custom markers freezing an empty initial
bitmap. Markers now wait for native layout and the icon font, then stop tracking
after a short render window. Selection, stale status, and appearance changes
refresh the snapshot. Stale markers use a dark glyph on the pale dark-mode fill.
An Android prebuild plugin also applies the measured-layout portion of
[the upstream marker sizing repair](https://github.com/react-native-maps/react-native-maps/pull/5536/files)
to the pinned Maps version (1.20.1). This prevents Fabric from clipping the 44 dp
marker to a 100 px bitmap. The patch is guarded and idempotent.

| Android gesture navigation, dark appearance | Screenshot |
| --- | --- |
| Before repair (`c90919e`): three saved reports, invisible custom markers | [Before](before/markers-android-gesture-dark.png) |
| After repair: visible Chalking, Ticketing, and Open spot markers | [After](after/map-android-gesture-dark.png) |
| Before native sizing repair: marker circles clipped at the right edge | [Before](before/markers-clipped-android-gesture-dark.png) |
| After native sizing repair: full marker circles and selected border | [After](after/detail-android-gesture-dark.png) |
| Before focus repair: detail-card padding interrupts the map animation | [Before](before/focus-android-gesture-dark.png) |
| After focus repair: selected report centered in the visible upper half | [After](after/detail-android-gesture-dark.png) |

Nearby selection now waits for the selected card's measured map padding before
animating. [Native camera readings](camera-focus-android.json) confirm zoom stays
at 16.485998 and the selected Ticketing marker moves to (205.71, 397.33) dp in a
411.43 × 914.29 dp map. This centers it horizontally and above the screen midpoint.

## Verification

- 65 unit tests and 37 component tests pass; mobile service coverage clears the
  repository's thresholds (86.36% lines, 76.68% branches).
- Android and iOS production JavaScript exports succeed.
- Expo Doctor passes all 18 checks.
- The app's own Android debug APK builds and installs. Native checks exercise
  parking, open-spot sharing, enforcement reporting, saved reports, verification,
  Settings persistence, and Android back navigation.
- A dedicated Android debug Maps key authorizes the app's package and exact
  signing certificate, restricted to Maps SDK for Android. Native map tiles,
  custom markers, and dark map styling render correctly. Marker visibility is
  checked after a cold start and after the tracking window has ended.
- The floating tabs, action cards, and sheets account for the system bottom
  inset. Settings switches have native touch bounds of at least 44 dp.

The local debug key is stored in a private file and an ignored local environment
file. Its value is absent from source and screenshot evidence. Existing release
key restrictions are unchanged; release signing requires its own authorized key.
Native clients require a rebuild for the Android marker-size backport and the
automatic appearance configuration.

## Verification limits

No iOS device or simulator is available on this Linux host, so iOS validation is
limited to the export and shared component behavior. No production API was used;
signed-in server and provider-linking flows were reviewed in code rather than
exercised against a live account during this visual QA.
