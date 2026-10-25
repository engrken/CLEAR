# CLEAR combined #47/#70 verification and latency visibility (2026-10-25)

## Roster verified-email remediation
Existing authorized Student Roster tab is now filterable by `?email=missing`
without fetching every roster page or exposing roster details in public OTP
endpoints. Staff must verify the student's identity through school policy
before using the existing Edit Student workflow. This patch does NOT
automatically assign emails, bypass OTP or amend Production data.

## Post-OTP performance visibility
The authenticated GET /api/mobile/orgs/:org/clearance response includes
`Server-Timing` durations for auth, financial clearance, QR certificate
and total request, but **only on successful verified-student requests**.
No request bodies, school IDs, emails, OTPs, receipt IDs, ledger values,
certificate URLs or PII are logged/stored. The private student UI
displays ephemeral end-to-end seconds from **Verify OTP** to result and
server clearance calculation time. It clears on Finish/expiry/session
revocation. These are per-request observations, not measured p50/p95 or
synthetic benchmarks. The API response retains Cache-Control: no-store.
No financial decision caching or session-throttle changes were made.

## Safe p95 runbook
Using authorized synthetic or approved test student accounts, repeat
verification over representative periods, device/network types and cold/warm
invocations. Collect only manually observed durations and Vercel function
region, keep timestamps anonymized, compute p50/p95 and review Neon query
plans against a representative non-Production branch. Never collect
student details, OTP, bearer tokens, QR URLs or raw receipts. If the
clearance calculation stage dominates, profile its DB queries; if total
time dominates with low server time, inspect OTP verification/network.
Do not claim #70 solved until thresholds are agreed and confirmed.
