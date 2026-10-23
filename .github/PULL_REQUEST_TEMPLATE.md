## Summary and affected workflows

Describe the change, tenant/role scope, and user-facing impact.

## Mandatory web ↔ Android parity check

Following the [standing parity policy](../docs/web-mobile-feature-parity-policy.md) ([issue #64](https://github.com/engrken/CLEAR/issues/64)):

- [ ] Web impact documented: page, API, tests, status.
- [ ] Android impact documented: screen, API, tests, status.
- [ ] Both source counterparts implemented, or linked to a specific tracked mobile/web counterpart with justification and release target.
- [ ] Shared permission/finance/clearance behavior stays equivalent where applicable.
- [ ] Any platform-only or security-prohibited functionality is marked as an explicit exception, **not** silently considered complete.

**Web implementation:** (path / PR / not applicable)

**Android implementation:** (path / PR / not applicable)

**Pending parity issue(s), or exception with rationale:** (link / none)

## Security and financial integrity

- [ ] Tenant/role/session/term authorization remains enforced server-side.
- [ ] Student clearance queries remain OTP-verified and status-only to unauthorized/public clients.
- [ ] Mobile Production business writes remain disabled unless separately authorized; no regression in OR numbering, ledger, balances or confirmation/audit.
- [ ] No credentials, private student information, signing keys or Production database access strings in commits or tests.

## Verification and release

- [ ] Relevant web/shared tests and TypeScript checks run.
- [ ] Relevant Android tests and TypeScript checks run.
- [ ] Preview UAT (browser/mobile viewport) and device QA plan recorded.
- [ ] Web Vercel release and Android Google Play release statuses documented **separately**.
- [ ] Android update recorded in consolidated [major-release backlog #61](https://github.com/engrken/CLEAR/issues/61).

Tests / screenshots / QA / limitations:
