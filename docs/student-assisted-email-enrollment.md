# Assisted roster email enrollment — issue #47 (2026-10-25)

## Objective
Avoid accidental loss or reassignment of the registered mailbox required for
the student-only clearance OTP. All student/private clearance and officer rights
are unchanged. The new staff acknowledgment **documents identity review** but is
**not independently verified mailbox ownership**.

## Authorized tenant procedure
1. Log in as an authorized officer with `tab-students`. Open the tenant's
   Students roster and **View students needing verified email**.
2. Check the student's identity against approved school records **out of band**.
   Do not accept an unauthenticated public school-ID/email claim as proof.
3. Open **Edit Student** on the specific record; enter the address confirmed
   with the student. Confirm the identity-review checkbox only after completing
   the school's procedure. The server rechecks the tenant, student, attestation
   and case-insensitive uniqueness, rejects empty replacement addresses, and
   audits the change without recording raw email, OTP, or bearer credentials in
   the new event. The update is transactional.
4. The student must request a **new clearance OTP sent to the registered
   mailbox**, then personally verify that OTP to prove mailbox possession.
   Email changes invalidate old student sessions on their next validation.
5. Verify only that student's own clearance status and record completion per
   school privacy policy. Do not post or publish students' names, emails,
   IDs, OTPs, or clearance amounts in GitHub comments.

## CSV import safety
- Imports may create new student roster records with their supplied addresses;
  these addresses are **not automatically marked as ownership-verified**.
- For students already present in the tenant, CSV import updates other roster
  and enrollment fields as before but **never modifies registered email**,
  whether the CSV email is empty, changed, or nonempty.
- The import result states the number of differing input email values that
  were preserved. Existing-email changes require the supervised edit path.
- New imported student emails are checked against existing tenant addresses.
  Transaction failures roll back the import; no partial financial mutations.

## Release and acceptance
- No production student records are changed by deploying this patch.
- No financial tables, fees, receipts or OR sequences are modified.
- Web officer UI and backend use the same tenant student data exposed through
  existing read-only mobile views; mobile business writes remain disabled.
  Additional native form workflows, if desired, belong in #81 / #64 and a
  consolidated Play release, **not** an automatic AAB build.
- Test on isolated synthetic records: missing email -> attested correction ->
  OTP; incorrect student identity, missing checkbox, duplicate address, blank
  replacement, unauthorized tenant/officer, CSV blank/change and OTP session
  invalidation. Real authorized staff must accept actual enrollments before
  closing #47. An officer checkbox alone must not be called an independently
  verified email address.
