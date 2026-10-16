# Android release: step by step

Everything runs from the `mobile/` folder. EAS CLI is not installed globally; `npx eas-cli@latest` downloads it (25.0.0 when this was written). `eas.json` requires `>= 25.0.0`.

| Item | Value |
| --- | --- |
| Android application ID | `com.rupertbulquerin.clear` (permanent once uploaded to Play) |
| iOS bundle ID (later) | `com.rupertbulquerin.clear` |
| Version | `1.0.0` (`expo.version` in `app.json`; bump it by hand for each user-visible release) |
| versionCode | Managed on EAS servers (`appVersionSource: "remote"`); starts at `1`, the `production` profile adds 1 on every build |
| Play Console | Account **RUPERT I.T. SOLUTIONS** (7443810319444220314), app **CLEAR System** (4975672424609848800), created 2026-10-16 with the package name reserved. Main store listing saved as a draft (text, icon, feature graphic); screenshots still to add. |
| Signing | A **new** upload key generated and stored by EAS; Google Play App Signing holds the app signing key |

> **Never use the keystore in "CLEAR System - Google Play package.zip".** It belongs to the old PWABuilder web wrapper (`app.vercel.clearsys.twa`), and its passwords were stored in plain text in the project folder. Treat it as compromised. This app has a different package name, so it doesn't need that key.

## Build profiles (`eas.json`)

| Profile | Output | Install | `EXPO_PUBLIC_API_URL` |
| --- | --- | --- | --- |
| `development` | Debug APK with the dev client | Emulator or phone, then `npx expo start --dev-client` | `http://10.0.2.2:3000/api/mobile` (the PC's `localhost:3000` as seen from the Android emulator) |
| `preview` | Release APK, internal distribution | Download link / QR from EAS | `https://clear.rupertbulquerin.com/api/mobile` |
| `production` | Release AAB for Play | Play Console | `https://clear.rupertbulquerin.com/api/mobile` |

`EXPO_PUBLIC_*` values are inlined into the JavaScript bundle at build time; they are not secrets. The development profile needs `expo-dev-client` installed first (see [NOTES.md](NOTES.md)).

## 0. Accounts (once, by you)

1. An Expo account at https://expo.dev/signup.
2. A Google Play developer account at https://play.google.com/console (USD 25, identity verification). Decide **personal** or **organization**:
   - **Personal** accounts must run a **closed test with at least 12 testers opted in for 14 days in a row** before Google allows a production release. Start that early.
   - **Organization** accounts skip that, but need a D-U-N-S number for the legal entity.

## 1. Link the project to EAS (once)

```bash
cd mobile
```

```bash
npx eas-cli@latest login
```

```bash
npx eas-cli@latest init
```

`init` creates the project on expo.dev and writes `expo.owner` and `expo.extra.eas.projectId` into `app.json`. Commit that change.

## 2. Preview APK (test on a real phone)

```bash
npx eas-cli@latest build -p android --profile preview
```

On the first Android build EAS asks **"Generate a new Android Keystore?"** Answer **Yes**. EAS creates the upload key and keeps it on its servers. Install the APK from the link or QR code, then check sign-in, clearance lookup, proof upload (photo picker) and remittance review against production.

Back up the key once: run `npx eas-cli@latest credentials -p android`, choose the build profile, then **Download credentials**. Store the `.jks` and its passwords in a password manager, **not** in the project folder (`*.jks` is git-ignored, but the old keystore shows how that goes).

## 3. Production AAB

```bash
npx eas-cli@latest build -p android --profile production
```

The first time, EAS asks to initialize the remote versionCode; accept `1`. Each later production build increments it.

## 4. Create the app in Play Console (once)

1. **Create app** (done 2026-10-16): name `CLEAR System`, package `com.rupertbulquerin.clear` (Play now asks for it at creation), English (United States), App, Free.
2. **App content** (Policy and programs → App content), using the drafts in this folder:
   - Privacy policy: `https://clear.rupertbulquerin.com/privacy` (fix the gaps in [privacy-policy-review.md](privacy-policy-review.md) first).
   - App access: **All or some functionality is restricted**. Give the reviewer a demo officer login that works without your inbox (see "Play reviewer access" in [NOTES.md](NOTES.md)) and the student IDs to try.
   - Ads: **No**.
   - Content rating: complete the IARC questionnaire (category "Utility, productivity, communication or other"; no violence, gambling, user-to-user chat or sharing).
   - Target audience: 18 and over (add 16–17 if first-year students may use it). Not under 13.
   - Data safety: [data-safety.md](data-safety.md).
   - Financial features: the app keeps records of payments made elsewhere; it doesn't move money, lend, or hold funds. Pick the closest "none / other" option and describe it that way.
   - Government apps: No. News: No. Health: No.
3. **Store listing**: [listing.md](listing.md), graphics in `graphics/`, screenshots per [screenshots.md](screenshots.md).

## 5. First upload: by hand (Google requires it)

Google Play's API can't create the first release of a new app, so `eas submit` only works after one manual upload.

1. Download the `.aab` from the production build page on expo.dev (or `npx eas-cli@latest build:list -p android`).
2. Play Console → **Test and release → Testing → Internal testing → Create new release**.
3. Accept **Play App Signing** (the default). Upload the `.aab`, add release notes from [listing.md](listing.md), and roll out to internal testers (add your own Google account to the tester list).

## 6. Later releases with `eas submit`

Once, set up a Google service account so EAS can upload for you:

1. Follow https://docs.expo.dev/submit/android/ ("Uploading a Google Service Account Key"): create a service account in Google Cloud, create a JSON key, and invite the service account in Play Console → **Users and permissions** with release rights for this app.
2. Upload the key to EAS (keep the JSON file outside the repo, then delete the local copy):

```bash
npx eas-cli@latest credentials -p android
```

Choose `production` → **Google Service Account** → upload the JSON key.

Then each release is:

```bash
npx eas-cli@latest build -p android --profile production
```

```bash
npx eas-cli@latest submit -p android --profile production --latest
```

`eas.json` sends it to the **internal** track as a **draft**; open Play Console to review and roll it out. Promote internal → closed testing (12 testers × 14 days on a personal account) → production from Play Console.

## Checklist per release

- [ ] `expo.version` bumped in `app.json` for user-visible changes (versionCode is automatic).
- [ ] `npm run typecheck` and `npm run lint` pass; `npx expo-doctor` reports no issues.
- [ ] Preview APK tested against production.
- [ ] Data safety still accurate (no new SDKs that collect data).
- [ ] Release notes written.

## iOS (later)

The bundle ID is already set. You'll need an Apple Developer account (USD 99/year), then `npx eas-cli@latest build -p ios --profile production` and `npx eas-cli@latest submit -p ios`; EAS creates the certificates. iOS uses the root `icon` PNG for now; a `.icon` (Icon Composer) file can replace it later.

## Play Console App content status (2026-10-16)

| Section | Status | Answers |
| --- | --- | --- |
| Ads | Saved | No ads |
| Government apps | Saved | No |
| Health | Saved | No health features |
| Financial features | Saved | "My app doesn't provide any financial features" (record-keeping only) |
| Content rating | Saved (IARC completed) | All Other App Types; user content sharing Yes (receipt images to org officers), interactions limited to invited members, no public sharing, no block/report/chat; everything else No. Result: Everyone / PEGI 3 / USK 0 / 3+. IARC contact: clearsysadmin@gmail.com |
| Data safety | **Draft** | As [data-safety.md](data-safety.md); no in-app account creation, accounts made outside the app ("employment or enterprise"); deletion URL `/account-deletion`. Final Save unlocks after Target audience. |
| Sign in details (App access) | Not started | Waits for the web deploy and the production demo code ([app-access.md](app-access.md)) |
| Target audience | Blocked | Play requires Sign in details first. Planned: 18+ (add 16–17 if first-years use it) |
| Privacy policy | Not started | Enter `https://clear.rupertbulquerin.com/privacy` after the deploy |
