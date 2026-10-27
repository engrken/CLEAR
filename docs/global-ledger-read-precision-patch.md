# Global/Officer mobile financial ledger — precision read regression (#99)

## Verified history, not a confirmed current outage

Vercel recorded **six failed read attempts** on October 24, 2026, 23:00–23:59 PHT in a **previous** Production deployment of the Android Global Superadmin JIECEP activity/ledger API. Error: `Invalid exact monetary amount.` It was a `GET` read failure, not evidence of a payment posting or a corrupted receipt.

Source stack: `GET /api/mobile/global/orgs/:org/ledger` → `listLedger` → `moneyCentavos`. `listLedger` combines **five** financial tables. Vercel did not identify the specific record or amount; **do not claim the issue was caused by penalty conversion**.

Read-only Production Neon aggregate audit on **October 25, 2026**, current active JIECEP period:

| Money column | Rows inspected | Invalid exact-centavo formats |
| --- | ---: | ---: |
| Collection.amountPaid | 472 | 0 |
| Collection.balanceDue | 472 | 0 |
| Penalty.fineAmount | 105 | 0 |
| Penalty.ratePerHour | 105 | 0 |
| CashAdvance.amountApproved | 19 | 0 |
| OnlineRemittance.amountPaid | 0 | 0 |
| CashierRemittance.amount | 0 | 0 |

Every checked value also fell within the safe integer-centavo range. **All 105** current-term JIECEP `Penalty.assessedAmount` values are null (historical records), so the original assessed amount is reconstructed on read from `hoursLate` and hourly rate. `hoursLate` is Float measuring **time**; monetary columns are database `numeric(18,2)`. This audit does **not** reconstruct the exact rows or DB state at the Oct24 incident time.

## Safe, backwards-compatible source patch (not deployed)

- Preserve the public `LedgerEntry[]` schema used by already-published Android **v1.2.4**, with **integer** `amountCentavos` and no added ambiguous amount/null.
- Apply the strict centavo parser to **every field** used in the five-category activity list, including collection allocation balances. Reject missing required monetary fields rather than substitute zero.
- Reconstruct legacy null assessed penalties from whole minutes and exact cents/hour, using the **existing nearest-cent** web policy. Legacy Float durations rounded to four decimal hour places (for example `4.4333` hours, which represents 266 minutes) are normalized using a tightly bounded 0.003001-minute drift tolerance; genuinely fractional service minutes fail verification. No change to `fineAmount`, original amount, cash or service settlement, OR status or rates. **No floor/truncation policy change**.
- If an old flat `LATE_FEE` has no `assessedAmount`, do **not** infer a fictional original charge from zero service minutes or from its potentially partially paid balance. Return the exact outstanding `amountCentavos` and omit optional `assessedCentavos` until the original value can be verified.
- Any future genuinely invalid ledger amount becomes **HTTP 422** with code `financial_data_review` and a comprehensible, privacy-safe message, instead of an unhandled **HTTP 500**. No partial list is passed off as complete; no misleading ₱0.00 or rounding.
- Server warning identifies **only the fixed record category and field**, never the student's identity, OR, raw amount, token, tenant slug, or other private money detail.
- GET-only and server-enforced role/tenant access gates are unchanged. The source patch changes **no database schema and performs no financial writes**.
- New Node 22 regression tests execute the actual TypeScript conversion helper; added to existing `npm run test:mobile-roles` CI suite.

## QA gates before closing #99

1. Run `node --experimental-strip-types --test tests/mobile-ledger-precision-read.test.mjs`; then `npm run test:mobile-roles`, `npm run test:finance`, `npx tsc --noEmit`, `npm run build`. Github Actions runners currently appear to fail before steps; treat PR as **draft** until verifiable CI/alternate test evidence exists.
2. On a compatible **isolated Neon test branch**, validate correct role-scoped active-term ledger and synthetic one invalid subcent row for each of the five tables. Assert the safe 422 code/message, no PII or invalid total, and no side effects. Exercise cross-tenant, unauthorized tenant-officer, student and global-admin sessions.
3. Confirm nearest-cent equivalence for 1, 2 and 5 minutes at ₱50/hour with the existing web penalty engine (₱0.83 / ₱1.67 / ₱4.17). No historical money values may be truncated or changed.
4. Authenticated Production **read-only** smoke check of Global Superadmin → JIECEP → Activity, and tenant officer Overview; verify current records load and there are no recurrence logs. Approval required before any deployment.
5. Keep the account's observed ledger discrepancy open until a successful authorized regression check; zero recent Vercel error logs without exercise of the route are **insufficient** to prove closure.

**Do not:** round down all payments, rewrite ledger values, disable exact-money guards, introduce partial financial totals, enable Android posting, or modify Production Neon as a shortcut.
