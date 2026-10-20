# Android payment idempotency — release verification

Status: implementation committed for review; NOT production validated.

## Setup
- Use an isolated PostgreSQL database with disposable test data.
- Run Prisma schema validation and apply migrations **only to the isolated database**.
- In the mobile workspace, regenerate package-lock.json using the project's package manager after installing expo-crypto, and commit the lockfile.
- Run web TypeScript/build checks and mobile typecheck/lint.
- Never test with real students, actual receipts, or production credentials.

## Required scenarios
1. Valid payment: one receipt, ledger entry, settlement events (if applicable), audit log, and digital receipt outbox entry; successful response.
2. Identical request key + identical body: same receipt ID, amounts and lines returned; no new accounting writes or duplicate digital receipt.
3. Identical key + changed amount, OR, fee, or student: 409 conflict; no new accounting writes.
4. Two concurrent requests with the same key: exactly one financial posting; the other either safely replays or returns a transient conflict that can be retried.
5. New key + reused OR: 409 duplicate OR; no financial write.
6. Network interruption after DB commit: app restarts, retries persisted key and draft; same original receipt returned.
7. Closed accounting period: new payment denied; completed identical retry should return original receipt.
8. Wrong department, revoked session, missing tab permission: request rejected before replay.
9. Package payment and penalty payment: all fund splits, balances, settlement events, and logs match existing web rules.
10. Verify web collection workflow remains unchanged.
11. Failed payment transaction: no orphan idempotency record or financial rows.
12. SecureStore unavailable or corrupted: never silently create duplicate receipt; officer can verify ledger before resubmitting.

## Release gates
- Inspect the complete diff and migration, including the Prisma relation fields.
- Confirm production rollout ordering: migrate database, deploy compatible API, then release APK.
- Run database-backed concurrency and retry integration tests.
- Confirm CI and mobile lockfile reproducibility.
- Review rollback plan: deployed server code must not depend on a table before migration exists.

Do not merge or deploy until every required gate is verified.
