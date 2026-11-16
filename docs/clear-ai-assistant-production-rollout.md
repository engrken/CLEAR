# CLEAR AI — production-only rollout and release gates

## Decision
Do **not** use Vercel Preview or Preview Neon databases for this release. The web-only AI feature will be validated in GitHub Actions using disposable PostgreSQL and synthetic test data, then deployed behind a fail-closed Production flag. No mobile API, Android screen, or mobile release is added.

## Production environment variables
Configure in Vercel Production only, server-side (never NEXT_PUBLIC):
- `GEMINI_API_KEY`: existing secret; do not print/decrypt/recommit.
- `GEMINI_MODEL`: existing model value; verify validity via restricted live smoke test only.
- `CLEAR_AI_ENABLED`: default unset/off; set `true` **only after code review, consent/privacy, and security checks**.
- `CLEAR_AI_ROLLOUT_MODE`: default unset/off. Set `officers` for initial restricted live UAT, with explicit allowlist. Set `all-paid` only after successful UAT and formal release approval.
- `CLEAR_AI_ALLOWED_OFFICERS`: comma-separated exact `tenant-slug:officer@example.edu` pairs; applies only when rollout mode is `officers`. No wildcards. Do not publish officer emails in GitHub.

Recommended sequence:
1. Do not merge or turn on CLEAR AI until current PR's GitHub checks and the security and privacy release gates below pass.
2. Merge reviewed PR to `main` only after verifying the intended production commit and GitHub branch protections. Vercel production deploys with AI **disabled** (no flag), so existing features remain available.
3. Verify production health, tenant isolation, and auth behavior with no Gemini requests.
4. Configure the allowlist for one authorized Pro/Corporate officer, set rollout mode `officers` and then set `CLEAR_AI_ENABLED=true`. Redeploy as needed so variables are applied to the deployment.
5. Officer conducts a narrowly scoped UAT using **non-personal questions**, checks aggregates against official reports, and confirms all other officers cannot call AI.
6. Disable immediately by removing `CLEAR_AI_ENABLED` or setting it to `false`, followed by a deployment/rollout of that config, if any issue occurs. Only move to `all-paid` when security, billing and user feedback are accepted.

## CI
The existing GitHub Actions `clear-web` job runs schema migration rehearsal, Next.js build, source regression, AI policy guard tests, Manila timezone tests and lint baseline on disposable PostgreSQL. Existing independent security/financial checks remain required. CircleCI must not be treated as the release gate. GitHub tests **do not** prove end-to-end Gemini connectivity.

## Must pass before live AI activation
- All required GitHub Actions and Vercel Production build checks for the intended commit.
- Real authenticated route tests in an isolated *CI* PostgreSQL service: no session; expired/revoked officer; cross-tenant; inactive tenant; Freemium; unauthorized module and invalid user; excluded Global Administrator.
- GitHub CI runs isolated PostgreSQL advisory-lock concurrency tests with synthetic records; test the production pooler configuration as a separate controlled acceptance gate.
- Enforce both officer and tenant rolling quotas (Pro 30/officer and 120/tenant daily; Corporate 100/officer and 500/tenant daily).
- The interface requires explicit acknowledgment that the prompt and authorized aggregate summary are transmitted to Google; server rejects common personal identifiers. Filtering cannot guarantee all identifiers are detected, so officer training and privacy approval remain required.
- Privacy review and institution notice/consent. This code transmits the officer's free-form question and a permitted organization-level aggregate to Google Gemini; never submit student identifiers, emails, passwords, receipt images, or personal financial details.
- Financial reconciliation for receipt/collection totals; no AI answer should be treated as a certified or authoritative ledger value.
- Gemini model permission, spend alerts, quotas, and error handling must be checked without exposing the API key.
- Keep AI read-only, server-enforced Pro/Corporate, tenant-session-bound, and per-module constrained; never model-generated SQL or money changes.

**No Production deployment, merge, feature activation, or live external data transfer is authorized by this documentation change.**
