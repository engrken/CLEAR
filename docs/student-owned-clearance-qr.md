## Student-owned clearance QR — verified private inquiry (October 25, 2026)
Issue #57 + web/mobile parity #64. Students should receive their own QR **only after** an exact
registered-email OTP login, confirmed current-term enrollment, live zero obligations and
a nonclosed period. The student-held QR is an encrypted bearer status proof that a clearance
officer scans with a phone camera; officer dashboard and officer API do not issue QR.
An officer should also check the physical or official student ID because QR possession
alone is not proof of identity. Public verification remains status-only (no name or balance).
Seven-day certificate duration and immediate live revocation on financial hold/enrollment
change/period closure are unchanged. Certificates are not linked to OTP session revocation;
do not claim single-use tokens or individual revocation list exist. Students with HOLD or
NOT ENROLLED, anonymous GET callers, wrong-tenant OTP holders, and period-closed students
receive no QR. The browser retains the QR only in React memory, clears after two minutes
or backgrounding; no credential/QR is persisted to localStorage/sessionStorage.
The already-shipped Android v1.2.2 ClearanceCard contains QR rendering; shared server
response now provides the encrypted URL to verified student sessions without enabling
financial writes. The native source also hides empty QR placeholders for future signed build.
Acceptance: isolated student HTTP runtime, cross-tenant/forged token, tampering, last-term
rollover, authorized browser and phone camera scan.