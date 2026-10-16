# App access: instructions for Google Play reviewers (draft)

Play Console → **Policy and programs → App content → Sign in details** (App access). Choose **All or some functionality is restricted**, then add one set of instructions with the text below.

**Hold this until the web deploy is live.** The reviewer sign-in exists in commit 23392e8, but it works only after:

1. `deploy\deploy.ps1` has run.
2. The demo org has been seeded (`prisma/seed-demo.js`, which targets Neon; needs your OK).
3. `DEMO_REVIEWER_EMAIL` and `DEMO_REVIEWER_CODE` are set on the VPS, followed by `pm2 restart clear-sys --update-env`.

Full steps: `play-review-web.md` in the shared notes folder. Then sign in once yourself with the steps below before pasting them into Play.

| Play field | Value |
| --- | --- |
| Name | `Demo officer (treasurer)` |
| Username / email | `reviewer@demo.clear.invalid` |
| Password | `<DEMO_REVIEWER_CODE>`: the 6-digit code you set on the VPS. Pick a new production value, don't use the local test value, and don't commit it. |
| Any other information | the text block below |

```
CLEAR System has two parts: a public student view (no sign-in) and an officer area (sign-in).

OFFICER SIGN-IN
1. On the first screen, open "CLEAR Demo Organization (sample data)", then tap Officer sign-in.
2. Enter the email reviewer@demo.clear.invalid and tap Send code.
3. Enter the 6-digit code given in the Password field. For this demo account the code is fixed and is not emailed, but it only works after tapping Send code.
4. A code works once and lasts 5 minutes. To sign in again, tap Send code again and enter the same digits. Five wrong tries lock the account for 15 minutes.
The demo officer is a treasurer: dashboard, ledger, recording payments and reviewing online payment proofs.

STUDENT VIEW (NO SIGN-IN)
In the same organization, look up a clearance with a student ID from DEMO-2026-0001 to DEMO-2026-0010:
- 0001 to 0003 paid every fee (Cleared)
- 0004 to 0006 paid part
- 0007 to 0010 paid nothing; 0010 also has an unsettled penalty
Pending online payment proofs to verify or mark invalid (officer area): from 0007 (GCash), 0008 (Maya) and 0009 (bank transfer).

All data in the demo organization is fictitious.
```

Keep the demo flag on the server for as long as any review may be running (every new release is reviewed again).
