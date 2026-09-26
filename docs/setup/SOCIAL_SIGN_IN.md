# Google and Apple sign-in setup

Park Opticon keeps its own user accounts and app sessions. Google and Apple
are sign-in methods attached to those accounts, rather than account providers
that can merge users by email address. This prevents a matching provider email
from taking over an existing Park Opticon account.

## What this implementation does

- Google uses the native Google Sign-In SDK to obtain a one-time server
  authorization code. The Go API exchanges it using the Google Web-client
  secret, verifies the returned ID token against Google's JWKS, and then
  creates the existing Park Opticon session.
- Apple uses native Sign in with Apple on iOS. The API creates a one-time
  nonce, verifies the Apple-signed identity token against Apple's JWKS, and
  consumes the nonce before issuing a Park Opticon session.
- Both methods are stored as `(provider, immutable OIDC subject)` mappings in
  `oauth_identities`. Emails are never used as the provider identity key.
- A user who already has a Park Opticon account must sign in normally and use
  **Account → Sign-in methods** to link Google or Apple. The app does not
  automatically merge accounts with matching emails.
- Before a new sign-in method is linked, the app requires a fresh Park
  Opticon password or a credential from a provider already linked to that
  account. Accounts with MFA enabled also require an authenticator or recovery
  code. The short-lived proof is single-use, and successful links create an
  audit record and in-app security notification.

## 1. Configure Google Cloud

1. In the [Google Cloud credentials console](https://console.cloud.google.com/apis/credentials), configure the OAuth consent screen for the Park Opticon project. Use only the `openid`, `email`, and `profile` scopes.
2. Create an **iOS** OAuth client with bundle ID `com.parkopticon.app`.
3. Create an **Android** OAuth client with package name `com.parkopticon.app`.
   Add the SHA-1 certificate fingerprints for each signing identity used by
   development builds, EAS production builds, and Google Play App Signing.
4. Create a **Web application** OAuth client. Its client ID is the native
   app's `webClientId`; its client secret stays on the Go backend.
5. Copy the iOS client's reversed client ID (for example,
   `com.googleusercontent.apps.1234567890-abc`) for the native iOS URL scheme.

The Google native SDK cannot run in Expo Go. Test it in an EAS development,
preview, or production build.

### Missing native module (`RNGoogleSignin`)

This error means the installed native binary does not contain Google Sign-In.
It happens in Expo Go or a custom app built before the dependency was added.
Reloading JavaScript or changing OAuth client IDs cannot add the native module.
Google actions remain visible on Android and iOS. Attempting sign-in checks
the native module before importing the SDK and immediately reports
`google_native_module_missing` with rebuild instructions if it is absent.
Missing native support is treated as a broken build, not an unavailable feature.

For an installable Android preview, configure the public build variables below
in the EAS preview environment, then run:

```sh
cd parkopticon
npx eas-cli build --platform android --profile preview
```

For full app testing, set `EXPO_PUBLIC_API_URL` to the backend origin (without
`/api/v1`; use HTTPS for deployed environments) and `GOOGLE_MAPS_ANDROID_API_KEY`
to a Maps SDK for Android key. The latter is embedded in the Android manifest
by `app.config.js`; restrict it to `com.parkopticon.app` and the signing SHA-1.
Expo Go supplies its own Maps key, but a standalone APK needs this project key
to use the map.

Opening Map in a standalone Android build without the key reports
`google_maps_not_configured` before creating the native map view. The Map tab
remains visible and Account remains accessible. Expo Go uses its built-in Maps
configuration and is exempt from this check.

Neither value is needed to compile the Google native SDK or exercise its account
selection flow. Without a backend URL the app opens sign-in and reports
`api_not_configured` when completing login, rather than silently entering guest
mode. Completing a Park Opticon session still requires a reachable backend;
a permanent domain is not needed for development testing.

### Local Android sign-in testing

The `local` EAS profile connects to `http://10.0.0.47:8080` on the same Wi-Fi/LAN.
It uses the preview OAuth credentials and opens Account after login, so the
session can be checked without opening the map. Google sign-in remains visible
and missing configuration is reported as an error. The map still requires its
own Android Maps key.

```sh
cd parkopticon
npx eas-cli build --platform android --profile local
```

If the server address changes, update both `EXPO_PUBLIC_API_URL` and
`PARKOPTICON_LOCAL_API_HOST` in that profile before rebuilding. The local config
plugin permits HTTP only to that private IPv4 address; other destinations use
the normal HTTPS policy. Production builds reject this local HTTP setting.
`EXPO_PUBLIC_AUTH_TEST_MODE=1` selects Account as the initial tab only for this
testing profile; ordinary builds still open Map.

Install the resulting APK and open Park Opticon itself. Ensure that APK's
signing certificate SHA-1 is registered on the Google Android OAuth client.
Use the Web OAuth client ID for `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.

## 2. Configure Apple Developer

1. In Apple Developer, open the explicit App ID `com.parkopticon.app`.
2. Enable **Sign in with Apple** and regenerate/update the provisioning profile
   if Apple asks you to do so.
3. Build a new iOS binary after this repository's `usesAppleSignIn` and
   `expo-apple-authentication` configuration changes are present.

The shipped UI offers Apple sign-in only on iOS. Supporting Apple on Android
or web later requires a Services ID, verified HTTPS domain/return URL, and
additional backend Apple key configuration.

## 3. Set mobile build variables

Put these in the environment used to bundle the Expo app (for example an EAS
environment), not in a committed `.env` file:

```dotenv
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=1234567890-example.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME=com.googleusercontent.apps.1234567890-example
```

Both are public identifiers. `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME` is used only
at native build time by the Google config plugin. It must be the reversed iOS
client ID, not the Web client ID.

## 4. Set backend environment variables

Add the following to the backend deployment secret store or `.env.prod`:

```dotenv
# Include the Web client ID. If additional allowed Google client IDs are ever
# added, comma-separate them here.
GOOGLE_OAUTH_CLIENT_IDS=1234567890-example.apps.googleusercontent.com
GOOGLE_OAUTH_SERVER_CLIENT_ID=1234567890-example.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=keep-this-in-the-backend-secret-store

# Native Apple token audience for this app.
APPLE_OAUTH_CLIENT_IDS=com.parkopticon.app
OAUTH_CHALLENGE_EXPIRY=5m
OAUTH_LINK_REAUTH_EXPIRY=5m
OAUTH_JWKS_CACHE_TTL=6h
```

`GOOGLE_OAUTH_SERVER_CLIENT_ID` must appear in
`GOOGLE_OAUTH_CLIENT_IDS`. Production API startup deliberately fails if either
provider is not fully configured. The OAuth secret is intentionally passed only
to the API container; the alert worker does not handle sign-in.

## 5. Deploy and test

1. Put the production API behind an HTTPS reverse proxy. The production Compose
   default binds the API to `127.0.0.1:8080`; set `API_BIND_ADDRESS` only when
   an equivalent TLS/network boundary is in place. Set `TRUSTED_PROXIES` to the
   narrow IP/CIDR of that proxy so login rate limits use the real client IP.
   The bundled PostgreSQL container is private to the same Compose network and
   explicitly opts into `DB_SSLMODE=disable`; do not expose its port. For a
   remote database, use `DB_SSLMODE=verify-full` with a CA certificate instead.
2. Deploy/restart the backend. Its startup migration creates
   `oauth_identities`, `oauth_challenges`, and one-time link-reauthentication
   records, and makes a social-first account's `password_hash` nullable.
3. Build a new iOS and Android native app; an over-the-air JavaScript update is
   not enough for the native Google and Apple capabilities.
4. Test a brand-new Google account, a brand-new Apple account on physical iOS,
   linking each method from an existing email/password account, repeat sign-in,
   cancellation, and attempting to link the same provider account to another
   Park Opticon user.

Do not store provider access tokens, refresh tokens, client secrets, or Apple
identity tokens in the mobile app or application database. The implementation
stores only the provider subject and connection timestamps.
