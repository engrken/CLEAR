# CLEAR consolidated acceptance gate

This single source-regression job discovers all standalone tests (excluding the two CI-only real HTTP/PostgreSQL suites) and runs them **once**, followed by web build and Android TypeScript. See the PR Checks page for complementary synthetic Postgres student OTP, financial concurrency, receipt sequence and migration jobs. Never run these with Production credentials.

**Issues mapped:** #47 private student OTP (real admin email enrollment for 10 missing addresses remains); #57 QR graphic and opaque tokens not yet restored; #58/#61 Play rollout still needs screenshot/app data; #64 parity maintained; #65 native history and Void UI pending; #69 no automatic financial record rewrites; #70 performance needs staging p50/p95; #81 native financial write endpoints remain disabled.

**Manual UAT:** with synthetic or explicitly authorized test accounts, check OTP one-time/expiry and tenant rejection, real signed certificate and forged URL, receipt/VOID search and pagination, student/officer/admin/superadmin access, Play-distributed Android navigation/Android vitals. No real financial transaction, database migration, unsanctioned email modification or QR camera rollout is authorized by a green CI check.

**Readiness meaning:** CI PASS means source regression and compilation only, not production business-acceptance for every open issue. Capture separate screen/device evidence and performance measurements before closing #47, #57, #65, #70, #81.
