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

No secret is needed during code review. The endpoint returns 503 until both values are configured.

## Release gates — DO NOT DEPLOY WITHOUT THESE
1. Run TypeScript, ESLint, and module/unit tests on a preview build.
2. Add a **transactional quota reservation** table/constraint; the provisional SystemLog rolling-window count is not atomic and concurrent requests can exceed it. Do not sell a metered subscription or turn on billable AI traffic until this is fixed.
3. Confirm Google Gemini data processing terms and institution privacy notices; avoid sending personally identifiable information in user prompts. Add explicit notice/consent if required.
4. Regression-test invalid/expired sessions, cross-tenant requests, revoked officers, inactive organizations, Freemium, Pro and Corporate, and fine-grained tab restrictions.
5. Confirm accounting semantics of aggregate collection totals and reconcile to official ledger; **do not treat this as a certified balance**.
6. Set Google API key restrictions, model cost ceiling, prompt/output token limits, abuse controls, and alerting.
7. Manually approve preview UAT before production deployment.

This is an initial demonstration of read-only Gemini-backed assistance, NOT a production-ready financial agent or unrestricted data analysis tool.
