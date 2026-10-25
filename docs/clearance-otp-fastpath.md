# CLEAR OTP clearance loading fast path (25 October 2026)

A verified OTP previously caused a second student directory lookup, sequential
setup/enrollment then obligation reads, a tenant-wide collectible scan, and a
full treasury ledger computation only to test formal term closure for QR.
The shared web/mobile backend now reuses the tenant/student/period/email-bound
OTP session identity, runs independent setup/enrollment/obligation reads in
parallel and limits current student collectible lookups to the exact SID marker.
It still checks every live current/older financial obligation, and fails
closed if an obligation query cannot run.

A new uncached, read-only period closure probe recognizes formal Closed
transitions, source-period rollover fund transfers, and matching reversal
events, without scanning the full collections, advances, audits or cashiers.
Full getPeriodLedger remains unchanged for financial reports.
No schema or Production financial writes. No caching of verified status.
Existing Android v1.2.2 uses the updated shared backend; no new Play AAB.

Release gates: consolidated source/regression, isolated OTP HTTP, receipt
sequence, financial concurrency, Next build and mobile TypeScript.
#70 remains open for measured p50/p95 real end-to-end web/app latency,
representative larger staging query plans and authorized user acceptance.
#47 email roster remediation remains a separate identity verification task.
