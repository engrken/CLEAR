# Archived legacy Excel migration (developer-only)

This directory preserves the historical `seed-excel.js` Google Sheets / Apps Script -> CLEAR PostgreSQL migration script for reference and controlled recovery work. It is **not** part of the CLEAR web application, Prisma seed workflow, npm postinstall, or deployment.

## Important safeguards

- The archived script **writes to the database**. Despite its original "safe synchronization" label, it can overwrite existing student details, tenant users, fund opening allocations and balances, collection payment totals, and other accounting fields.
- The source contains hard-coded historical defaults, including the `engineering` tenant and A.Y. 2026 - 2027. It is not a generic tenant importer.
- Date conversion, partial upserts, row uniqueness, and schema assumptions should be reviewed before any reuse. **No dry-run mode is provided.**
- Never point it at production, a Neon/Vercel connection, a shared tenant database, or a database reached through a localhost proxy/tunnel.
- Its opt-in guard rejects production/VERCEL environment and non-local PostgreSQL hostnames, but a local proxy could evade the hostname check; **the operator must still independently verify the database target**.
- Keep archived source and historical workbook private; the workbook may contain personal and financial records. Do not copy the workbook into `public/`, client bundles, build artifacts, or public repositories.
- Any future import should be rebuilt as a separately reviewed one-off tool with explicit organization mapping, validation, preview, duplicate handling, transactional writes, and audit logs.

## Location and prerequisites

The original source was moved from repository root to `scripts/legacy/seed-excel.js`. It expects the historical input workbook at repository root:

`Department Financial Audit Database.xlsx`

This workbook is left unchanged for historical evidence; moving/replacing it is a separate data-retention decision. No runtime route imports the archived script.

## Controlled local-only recovery procedure

1. Make a verified backup of the target isolated LOCAL development database (and a sanitized copy of the input workbook).
2. Review and update the script for the *current* Prisma schema and verify the workbook columns; do not assume it will still run correctly.
3. From the repository root, verify that `DATABASE_URL` points directly to an isolated PostgreSQL instance on `localhost` / `127.0.0.1` / `::1`, and that `NODE_ENV` is not `production`.
4. If you deliberately authorize a test on that isolated local database, set `CLEAR_LEGACY_EXCEL_IMPORT=ALLOW_LOCAL_DEV_ONLY` for that one shell/process and run `node scripts/legacy/seed-excel.js`.
5. Reconcile row counts, totals, student associations, and historical audit records against the backup, and restore the isolated database after testing if needed. Never promote a historical seed run into a live database.

The opt-in flag is deliberately not added to npm scripts or automated jobs. The routine CLEAR application uses PostgreSQL as its source of truth and retains ordinary CSV functionality independently.
