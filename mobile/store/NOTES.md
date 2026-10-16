# Release notes for the team: open items

Things this release prep couldn't do inside its scope (`eas.json`, `app.json` build fields, `store/`). Each needs the user or another session.

## Needs a dependency (not installed here)

| Package | Why | Command |
| --- | --- | --- |
| `expo-dev-client` | The `development` build profile sets `developmentClient: true`; that build needs this package. | `npx expo install expo-dev-client` |
| `expo-updates` (optional) | Over-the-air JS updates. `app.json` already sets `runtimeVersion: { policy: "appVersion" }`. After installing, run `npx eas-cli@latest update:configure` (adds `updates.url`) and add a `channel` per profile in `eas.json`. | `npx expo install expo-updates` |

## For the API-client session (`mobile/src/**`)

- Read the base URL from `process.env.EXPO_PUBLIC_API_URL`. EAS builds set it per profile in `eas.json`. For `npx expo start` (Expo Go or dev client), put it in `mobile/.env.local` (git-ignored), for example `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000/api/mobile` for the emulator, or `http://<PC LAN IP>:3000/api/mobile` for a phone on Wi-Fi.
- Release builds block plain HTTP (Android's cleartext default), so only `development` builds can reach `http://` URLs. Keep it that way; don't add `usesCleartextTraffic`.
- Permissions: `app.json` blocks camera, microphone, overlay and the `READ_MEDIA_*` permissions. The resulting manifest has only `INTERNET`, `VIBRATE` and `READ_EXTERNAL_STORAGE` (Android 12 and older). Receipt upload must use `launchImageLibraryAsync` (the system photo picker). If you add "take a photo", remove `android.permission.CAMERA` from `blockedPermissions`, set `cameraPermission` in the `expo-image-picker` plugin, and update [data-safety.md](data-safety.md).
- `expo-secure-store` is configured to keep the token out of Android backups (its plugin's backup rules show in the manifest). Good; keep it.

## For the server / web session

- **Play reviewer access.** Officer sign-in sends a code to the officer's email; a Google reviewer can't read that inbox, and Play rejects apps whose restricted parts reviewers can't open. Option: a `demo` organization with seeded fake data and one viewer/treasurer officer whose code is fixed or delivered somewhere the reviewer can see, limited to that org only and easy to switch off. Don't weaken sign-in for real organizations.
- **Privacy policy** (`app/privacy/page.tsx`): see [privacy-policy-review.md](privacy-policy-review.md).
- **Deletion requests:** an `/account-deletion` web page and an admin procedure (deactivate officer, revoke mobile sessions, delete proof images on request). See [data-safety.md](data-safety.md#account-deletion).

## For the user (Rupert)

- **Package name `com.rupertbulquerin.clear`** is permanent once uploaded. Change it in `app.json` (android.package and ios.bundleIdentifier) before the first Play upload if you want a different one. The old `app.vercel.clearsys.twa` is the PWABuilder wrapper; don't reuse it.
- **Old keystore:** the "CLEAR System - Google Play package.zip" keystore and its plain-text passwords should be removed from the project folder and kept only in a password manager (or deleted if the TWA listing is retired). It is not used for this app.
- **Filamer Christian University's name and seal.** The listing names FCU, and `assets/images/fcu-seal.png` ships in the app. Play's impersonation policy can reject apps that look official without permission. Get written OK from FCU (OSA or the org adviser), or add the "not an official app" line from [listing.md](listing.md).
- **Contact email:** the privacy page lists `clearsysadmin@gmail.com`. Make sure you control it, or switch to an address you do; the same address goes in the Play listing.
- **Personal vs organization Play account:** a personal account needs 12 testers for 14 days before production. See [RELEASE.md](RELEASE.md#0-accounts-once-by-you).
- **Icons:** the new icons (`assets/images/clear-*.png`, `store/graphics/`) use the app's own mark: the Bootstrap Icons shield-check (MIT license) in the brand sky `#38bdf8` on navy `#0b1329`. Swap in a designed logo whenever you have one; keep the adaptive foreground inside the centre 66% circle. The old template images (`android-icon-*.png`, `splash-icon.png`, `assets/expo.icon`) are no longer referenced and can be deleted.
