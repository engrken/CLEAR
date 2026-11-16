# CLEAR AI Assistant — web-only preview

Feature branch: `feature/gemini-web-officer-assistant`.

## Scope
- Web-only officer page: `/department/[department]/ai-assistant`; **not** added to Android.
- Pro / Corporate organizations: chat enabled for currently authenticated, active tenant officers.
- Freemium: locked feature with an explicitly labeled sample response.
- Server always rechecks current tenant membership, subscription tier, and module permissions.
- Gemini only receives a small **active academic-period aggregate** (valid collections, liquidation expenses and cash advance totals where authorized), not students, receipt images, individual names, arbitrary SQL or full ledgers.
- No AI-controlled writes. Prompts and completions are not persisted in the database; usage event metadata is recorded in the existing SystemLog.

## Configuration
Set the following as **server-only** Vercel environment variables, not NEXT_PUBLIC variables:
- `GEMINI_API_KEY`: Google AI Studio API key. Never commit this value.
- `GEMINI_MODEL`: an available supported model ID (e.g. check Google AI Studio model listings before choosing).
- `CLEAR_AI_ENABLED`: set to `true` only for the reviewed Preview branch; default OFF everywhere.

No secret is needed during code review. The endpoint returns 503 until both values are configured.

## CI provider and low-cost verification
- **Authoritative CI: GitHub Actions**, not CircleCI. The existing `.github/workflows/clear-github-release-checks.yml` runs web build, database migration rehearsal, source regression, lint baseline, mobile checks, and now `tests/ai-officer-access.test.mjs`. This reuses a single existing PR job instead of launching a second heavyweight workflow.
- Existing `.github/workflows/financial-actions-integration.yml`, `.github/workflows/student-clearance-runtime.yml`, and the Prisma/receipt/dependency workflows remain in place for relevant regression coverage.
- Vercel Git integration builds the web Preview. A successful Vercel build and GitHub tests are separate signals; neither confirms a live Gemini API request or isolated preview database.
- **CircleCI is not disconnected by code changes.** After the GitHub equivalent passes, disable the CircleCI project integration in CircleCI settings to stop duplicate runs. Leave `.circleci/config.yml` as a historical fallback until the external integration is retired, then remove it in a separate audited change.
- The repository currently has an active ruleset *named* `CircleCI`, but its `required_status_checks` list was empty during inspection. Review Settings → Rules → Rulesets and replace any CircleCI required checks with the verified GitHub checks (without removing pull-request or non-fast-forward protections).
- No production credentials are used by the GitHub AI test; it is intentionally a policy/source regression test. Run the separate isolated DB concurrency and authenticated HTTP tests before enabling preview AI traffic.

## Release gates — DO NOT DEPLOY WITHOUT THESE
1. Run TypeScript, ESLint, and module/unit tests on a preview build.
2. Exercise the **transactional PostgreSQL advisory-lock quota reservation** with concurrent synthetic requests on isolated PostgreSQL. Failed provider requests count against daily quota. Validate lock behavior with the deployed pooler. Do not sell metered AI subscriptions until load tests pass.
3. Confirm Google Gemini data processing terms and institution privacy notices; avoid sending personally identifiable information in user prompts. Add explicit notice/consent if required.
4. Regression-test invalid/expired sessions, cross-tenant requests, revoked officers, inactive organizations, Freemium, Pro and Corporate, and fine-grained tab restrictions.
5. Confirm accounting semantics of aggregate collection totals and reconcile to official ledger; **do not treat this as a certified balance**.
6. Set Google API key restrictions, model cost ceiling, prompt/output token limits, abuse controls, and alerting.
7. Manually approve preview UAT before production deployment.

Google now recommends the Interactions API for new agentic workflows; the current single-turn, read-only prototype uses the still-supported `generateContent` endpoint with no model-executed tools.

This is an initial demonstration of read-only Gemini-backed assistance, NOT a production-ready financial agent or unrestricted data analysis tool.
