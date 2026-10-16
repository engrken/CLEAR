# Data safety form (draft)

Play Console → **Policy and programs → App content → Data safety**. The answers below describe the app as wired to `/api/mobile` (see the API spec in the shared notes). Re-check them if the app gains analytics, crash reporting, push notifications or camera capture.

## Overview questions

| Question | Answer |
| --- | --- |
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes**: release builds talk only to `https://clear.rupertbulquerin.com/api/mobile`. (The `development` build profile uses plain HTTP to a local server; it is never shipped to Play.) |
| Do you provide a way for users to request that their data is deleted? | **Yes**: by email to the CLEAR administrator today. A web request page is recommended (see [NOTES.md](NOTES.md)). |

## Data types

"Collected" means sent off the device to the CLEAR server. Nothing is **shared** with third parties: Neon (database), the VPS host and Resend (sign-in email) act as service providers on our behalf, which Play does not count as sharing. No data is sold, and none is used for ads or analytics.

| Category → type | Collected | Who | Required or optional | Purposes | Processed ephemerally? |
| --- | --- | --- | --- | --- | --- |
| Personal info → **Email address** | Yes | Officers (sign-in) | Required | App functionality, Account management, Fraud prevention, security and compliance | No |
| Personal info → **User IDs** | Yes | Students (school ID for clearance lookup and proof upload); officers (account id) | Required | App functionality | No |
| Personal info → **Name** | Yes | Students' names come from the org roster and are shown to officers; the app itself does not ask students for a name. Declare it to be safe, because the app displays and links it to payments. | Required | App functionality | No |
| Financial info → **Other financial info** | Yes | Payment amount, payment channel (GCash, Maya, bank transfer), reference number, OR number, fee item | Required | App functionality | No |
| Photos and videos → **Photos** | Yes | Students: a screenshot or photo of the payment receipt, chosen with the system photo picker (≤ 4 MB) | Optional (only when submitting an online payment proof) | App functionality, Fraud prevention, security and compliance | No |

### Not collected

- Location, contacts, calendar, messages, audio, files, health, web history.
- Device or other IDs: the server records the HTTP user agent of an officer's session (for example `okhttp/4.x`) to show and revoke sessions. It is not a device identifier. No advertising ID is used.
- App activity, app info and performance, crash logs: there is no analytics or crash-reporting SDK.
- Financial info → "User payment info" (card or bank account numbers): **not collected**. The app never takes payments; it only records that one happened.

## Security practices

- Encrypted in transit: **Yes** (HTTPS/TLS to the API; the database connection is TLS too).
- The officer sign-in token is kept in the device keystore (`expo-secure-store`) and is excluded from Android backups by the plugin's backup rules.
- Sign-in codes are hashed, single use, expire after 5 minutes, and lock after 5 wrong tries.
- Independent security review: **No** (leave unchecked).

## Account deletion

Play asks for an account deletion URL only when users can **create** an account in the app. CLEAR has no sign-up: officer accounts are created by each organization's administrator on the web, and students have no account. So answer **"No, my app does not allow users to create an account"** on the App access / account questions.

Still state a deletion process in the privacy policy and on a web page, because the Data safety answer above says "Yes":

1. The user (officer or student) emails the CLEAR administrator from their institutional email, naming their organization.
2. The administrator deactivates the officer account (access stops at once; mobile sessions are revoked) and removes contact details that are not needed.
3. Financial records (payments, OR numbers, remittances) are kept for the organization's audit period, because they are the organization's books and other students' clearance depends on them. Say this plainly in the policy.
4. Payment proof images are deleted on request once the remittance has been verified or invalidated.

Steps 2–4 need a real procedure on the web side; see [NOTES.md](NOTES.md).
