# Park Opticon contributor guidance

## Source of truth

- Runtime behavior belongs to the code, especially `parkopticon/src/` for the
  mobile app and `backend/` for server behavior.
- The maintained mobile design contract is
  [docs/design/DESIGN_QUICK_REF.md](docs/design/DESIGN_QUICK_REF.md).
- Older design files under `docs/design/` are historical references unless
  they explicitly identify themselves as current.

## Current mobile UI contract

The mobile product is deliberately map-first, calm, and fast to act on. Do
not add controls or reassurance copy merely because a surface has empty space.

### Navigation

- The only persistent tabs are **Map** and **Account**.
- **Settings** is a secondary stack screen. Nearby reports is an in-map
  bottom-half modal, not a route or tab. Do not restore either as a bottom tab
  without an explicit product decision.
- **Report enforcement** is a transparent native-stack modal over the map,
  not a full-page destination.

### Map screen

- The map is the primary surface. Keep visible chrome to one status surface,
  one small nearby-reports card, and one compact bottom action card.
- The bottom card has a primary **Park here** / **Unpark** action and a
  labelled secondary **Report** action in one row. Show `Parked · N min` only
  while a parking session is active; do not show redundant idle copy such as
  “Ready to park.”
- Do not put ads, permanent tutorials, a radius circle, or stacked banners in
  the parking decision area.
- Marker selection replaces the parking card with the report-detail card.
  Keep report verification available there; do not duplicate marker callouts.
- Nearby reports are a compact, informative card—not an underlined text link.
  It opens a bottom-half list modal. Selecting a row closes that modal, centers
  the marker in the map's visible upper half, and opens the existing detail
  card for verification.

### Enforcement reporting

- Keep the modal short: title, **Chalking** and **Ticketing** choices, and
  **Send report**. The map must remain visibly behind it.
- Resolve location silently. Reuse fresh coordinates from `MapScreen` when
  available, otherwise fetch them on demand. Do not expose GPS accuracy,
  location spinners, refresh controls, or technical location errors.
- Preserve the existing 50 m accuracy gate, API/offline submission paths, and
  a single generic submission failure message.

### Layout, accessibility, and Android

- Compact visual spacing is preferred, but interactive controls must remain at
  least 44 px tall/wide. Do not reduce the primary parking action below 48 px.
- Use `react-native-safe-area-context` for system insets. Android edge-to-edge
  requires the bottom-tab height and padding to include `insets.bottom`.
- The map sheet sits above the tab navigator’s reserved space; transparent
  modal sheets must add their own `insets.bottom` margin.
- Keep text labels on secondary actions. Icons may support an action but must
  not be its only visible meaning.

## Mobile validation

After mobile UI/navigation changes, run:

```sh
cd parkopticon
npx expo export --platform android --output-dir /tmp/parkopticon-android-export
npx expo-doctor
```

The browser build is not a substitute for mobile map QA because
`react-native-maps` is native-only. Prefer a current Android/iOS device or
emulator for visual checks.
