# Privacy policy review: https://clear.rupertbulquerin.com/privacy

Checked 2026-10-16. The page is live (HTTP 200), public, not behind a login, and is a real HTML page, which is what Play requires. It is source file `app/privacy/page.tsx`; it was **not** edited here.

## What it already covers

- Name of the system and who it serves (departments and student organizations).
- Officer email addresses and one-time-code sign-in.
- That financial records, liquidations and audit logs are stored, and in an encrypted database.
- A contact email (`clearsysadmin@gmail.com`).

## Gaps to fix before submitting to Play

Play rejects policies that don't match the Data safety form, so the page should be updated to say:

1. **Student data.** Student ID, full name, year level and (optional) email from the org roster, and the clearance status shown publicly by student ID.
2. **Payment proofs.** Receipt screenshots/photos uploaded by students, plus payment channel, reference number and amount.
3. **The Android app by name.** It says "mobile APK", which refers to the old web-wrapper app. Name "CLEAR System for Android (com.rupertbulquerin.clear)" and say the app uses the same data as the web.
4. **Device permissions.** Photo picker only, to attach a receipt; no camera, location or contacts.
5. **Service providers.** Database hosting (Neon), server hosting (the VPS provider), email delivery (Resend). No data is sold or shared for advertising.
6. **Retention.** How long financial records and proof images are kept (for example, the audit period of the academic year plus N years), and that sign-in codes expire after 5 minutes and mobile sessions after 7 days.
7. **Deletion and access requests.** The process in [data-safety.md](data-safety.md#account-deletion), including what is kept for audit and why.
8. **Philippine Data Privacy Act of 2012 (RA 10173).** Who the personal information controller is (each organization? the operator?), the data subject's rights (access, correction, erasure, objection), how to complain to the National Privacy Commission, and a data protection officer contact.
9. **Who operates it.** An operator name and contact the user controls. `clearsysadmin@gmail.com` may belong to the previous maintainer; confirm who reads it.
10. **Age.** Users are university students; state that the service isn't directed at children under 13 (Play's Families rules don't apply then).
11. **Changes.** How users are told about policy changes; keep the effective date current.

Optional but cheap: add `/account-deletion` (a page explaining the steps, with a mailto link), and link it from the privacy page and from the app's More screen.
