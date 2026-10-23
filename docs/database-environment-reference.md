# CLEAR — Production and Preview database environment reference

**Last checked:** 2026-10-23 (Asia/Manila)  
**Source of truth:** Neon project `clear-sys-db` (`wandering-wind-73071792`) and Vercel project `clearsys` (`prj_RaSibcpC2ZJq4isr31v8XPrJPmsT`).  
**Purpose:** Reuse known **non-secret** database identifiers without repeatedly searching old chats or asking anyone to disclose a PostgreSQL password.

> **Security:** These are database endpoint *references*, **not usable connection strings**. Do not commit or paste `DATABASE_URL`, `DIRECT_URL`, usernames, passwords, access tokens, URI credentials or decrypted environment-variable values. Vercel/Neon environment secrets remain the only source for actual credentials. Do not substitute a Preview URL for Production or vice versa.

## Canonical branch and endpoint reference

| Environment | Neon branch (immutable ID) | Neon direct/unpooled PostgreSQL hostname | Database | Status |
| --- | --- | --- | --- | --- |
| **Production** | `br-calm-dew-b3vd1ira` | `ep-dry-wildflower-b35od340.c-4.ap-southeast-1.aws.neon.tech` | `neondb` | Verified as Neon **default/primary** branch and its current read-write compute, 2026-10-23 |
| **Android integration Preview** | `br-crimson-sea-b3uiuqe1` | `ep-cool-thunder-b3wwjz4j.c-4.ap-southeast-1.aws.neon.tech` | `neondb` | Verified as **nonproduction** branch and read-write compute, 2026-10-23 |
| **Historical v2.4 E2E staging** (not Android Preview or Production) | `br-solitary-morning-b3amr5wy` | `ep-tiny-violet-b39872ht.c-4.ap-southeast-1.aws.neon.tech` | `neondb` | Verified as separate nonproduction branch, 2026-10-23 |

All three are in Neon AWS `ap-southeast-1` (Singapore). In particular, **do not assume a Neon branch named `main` is Production**: the actual Vercel-linked default/primary Production Neon branch is identified above.

### Credential-free URI references (nonfunctional until secrets are supplied privately)

- Production direct endpoint: `postgresql://<USERNAME>:<PASSWORD>@ep-dry-wildflower-b35od340.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`
- Android Preview direct endpoint: `postgresql://<USERNAME>:<PASSWORD>@ep-cool-thunder-b3wwjz4j.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`
- Android Preview **expected pooled** endpoint (documented in `mobile/GLOBAL_SUPERADMIN_PREVIEW.md`): `ep-cool-thunder-b3wwjz4j-pooler.c-4.ap-southeast-1.aws.neon.tech`.

**The URI examples above are templates only; no credentials are stored in this repository.** The Preview pooled hostname comes from the existing Android Preview runbook, **not from decryption of Vercel's live variable**. An endpoint name can rotate when infrastructure changes; recheck current Neon branch computes before a sensitive operation.

## Vercel environment-variable mapping

Vercel project: `clearsys`, ID `prj_RaSibcpC2ZJq4isr31v8XPrJPmsT`, Production domain `https://clearsys.vercel.app`.

| Vercel scope | Variable | Configuration evidence | Expected Neon target |
| --- | --- | --- | --- |
| **Production** | `DATABASE_URL` | Production-specific sensitive Vercel env entry (ID `kLmQTcd32mWxy4UL`) | Production `br-calm-dew-b3vd1ira` |
| **Preview** — Git branch `android-parity-integration` **only** | `DATABASE_URL` | Branch-scoped sensitive Vercel env entry (ID `IKXNtFgs1lfTiOIh`) | Android Preview `br-crimson-sea-b3uiuqe1` |
| **Production + Preview** | `DIRECT_URL` | Shared sensitive Vercel env entry (ID `lFj1M2NlGC1aA9Mi`) | **Not independently attested.** Never blindly use for schema changes; verify the target branch and use an approved branch-specific direct connection. |

**Evidence limitation:** Vercel reports the variables' names, scopes and existence, but their plaintext values remain protected (`decrypted: false`), even with connected Vercel access. Accordingly, the mapped Neon targets are the **approved/expected configuration**, **not a cryptographic or runtime proof** that Vercel's currently deployed secret points there. Avoid claiming a Production/Preview binding is verified solely because the Neon hostname above exists or because a Vercel build is green.

## Safe verification and release procedure

1. Identify environment **first**: Production, Android integration Preview, or separate staging. Resolve the **Neon immutable branch ID**, not a mutable branch name.
2. Read Neon's current default branch and branch compute list. Confirm that the hostname belongs to the intended branch. Use `SELECT current_database()` (read only) to confirm the database name.
3. Read Vercel project's environment-variable **scope and existence** via the authenticated Vercel integration. Do not decrypt, copy, log or request secret contents in chat or GitHub.
4. If release safety requires proof of Vercel's **runtime** database binding, use a preauthorized **token-gated application diagnostic** that returns only a Boolean/match status, or a secure operator-controlled verification. A GitHub reference, Vercel variable metadata and a successful build **do not by themselves** prove the runtime target.
5. Before Production schema migrations: preserve a current recovery point, compare financial fingerprints, verify no unresolved migrations, get the release approval, and make sure the actual migration target is the approved Production branch. **Never** run `prisma db push` or point migrations at a generic Preview `DIRECT_URL`.
6. Reverify and **update this document whenever an endpoint, branch assignment, Vercel environment scope or associated project changes**. Record the verification date and method. Never update it with credential values.

## Related records

- `mobile/GLOBAL_SUPERADMIN_PREVIEW.md`: original Android Preview direct/pooled hostname and Vercel Preview branch scope.
- `docs/v2.4-production-release-runbook.md`: historical Production hostname and branch identity (some older migration states/counts are historical, not current).
- `docs/pr46-production-release-runbook.md`: earlier Production database recovery safeguards.
- [PR #60 release record](https://github.com/engrken/CLEAR/pull/60): database migration completed, verified backups and Production deployment, October 23, 2026.

**Reference rule:** For future CLEAR work, read this file first for expected Production/Preview database identities; verify live Neon/Vercel metadata when executing migrations or releases. Never ask a user to post a complete database URL.
