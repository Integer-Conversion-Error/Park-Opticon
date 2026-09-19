# Current mobile design reference

**Status — 2026-09-13:** this is the current design contract for the focused
parking MVP. Follow the registered routes in
`parkopticon/src/navigation/AppNavigator.js` and the implementations in
`parkopticon/src/screens/`.

## Product direction

Parkopticon is a calm, map-first parking-safety product. The map should make
the current parking decision obvious, while reporting should be a fast,
two-tap action. Prefer removal, progressive disclosure, and concise status
over decorative cards or explanatory copy.

## Navigation

- **Primary tabs:** Map and Account only.
- **Secondary stack screen:** Settings.
- **In-map modal:** Nearby reports opens as a bottom-half list sheet over the
  map rather than as a separate screen.
- **Transparent modal:** Report enforcement appears over the existing map, so
  the user retains spatial context rather than entering a separate page.

## Map design

The Map screen has three layers:

1. **Map canvas:** user location and restrained community markers.
2. **Top context:** one highest-priority status pill plus a compact nearby
   reports card. The reports card shows a count and one helpful line, then
   opens a bottom-half reports sheet.
3. **Bottom action card:** a compact action row. The primary action is
   **Park here**, **Unpark**, or **Unpark & share**; the secondary action is a
   clearly labelled **Report** control. While parked, show only the useful
   `Parked · N min` eyebrow. Do not add an idle heading.

Do not place ads, a permanent tutorial, a visible notification-radius circle,
or stacked notification/location/sync banners in the primary map decision
area. Selecting a marker replaces the parking action card with a compact
report-detail card and its verification actions.

The reports sheet is a compact list, not a stack of report cards. Each row
shows type, age, optional distance, and a locate affordance. Selecting a row
closes the sheet, preserves the current zoom, shifts the map so the marker is
in the visible upper half, and opens the report-detail card.

## Enforcement report modal

The enforcement flow should feel like a Waze-style quick report:

- a small bottom sheet over the dimmed map;
- **Chalking** and **Ticketing** as two equal, selectable icon tiles;
- one **Send report** action;
- one generic failure message only when a report cannot be sent.

Location is an implementation detail. Reuse a fresh map location when
available and resolve a new location silently when needed. Do not show GPS
accuracy, loading indicators, refresh controls, or location-specific errors.
The 50 m accuracy guard remains in code to protect report quality.

## Visual and interaction rules

- Use the theme in `parkopticon/src/theme/`: quiet slate surfaces, deep teal
  primary actions, and amber/red only for meaningful report states.
- Favor compact padding and short vertical stacks. Keep detail only after a
  marker or card is selected.
- Preserve at least 44 px touch targets. The compact map parking controls may
  be 48 px; do not make them smaller.
- Icons support labels; they do not replace visible action text.
- Use `react-native-safe-area-context` for all system-bar decisions. Android
  tab-bar height and bottom padding must include `insets.bottom` so the system
  navigation bar cannot cover app controls.

## Product constraints to preserve

- A parked location is private; users see only nearby community report data.
- Alert radius is 100–2,500 metres; new accounts default to 1 km.
- Open spots created when a user unparks are approximate and short-lived.
- Offline/guest state must not be presented as live community data.

The older UX/Figma documents are retained as historical design exploration;
they describe deleted screens and planned workflows that are not all implemented.
