# Mobile assets

The app currently uses these checked-in Expo assets:

| File | Used by |
| --- | --- |
| `icon.png` | App icon |
| `adaptive-icon.png` | Android adaptive icon foreground |
| `splash.png` | Expo splash screen |
| `favicon.png` | Expo web favicon |

The active UI uses `@expo/vector-icons` for map/report/navigation icons; it does
not require the previously documented custom marker-image tree.

When replacing an asset, keep its path aligned with `parkopticon/app.json` and
test Android, iOS, and web builds. Do not add photo/report assets here as a
substitute for a storage upload pipeline—the backend has no completed
end-to-end photo upload API yet.
