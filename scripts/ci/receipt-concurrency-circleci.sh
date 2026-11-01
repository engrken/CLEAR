#!/usr/bin/env bash
# Ported from .github/workflows/receipt-sequence-check.yml.
# Execute ONLY against the disposable CircleCI PostgreSQL service after migrate deploy.
set -euo pipefail
if [[ "${CLEAR_DB_AUDIT_SCOPE:-}" != "isolated" || "${DATABASE_URL:-}" != "postgresql://clear_ci:clear_ci@127.0.0.1:5432/clear_ci?schema=public" ]]; then
  echo "Refusing receipt concurrency probes outside the isolated CircleCI database" >&2
  exit 2
fi
export PGPASSWORD=clear_ci
mkdir -p /tmp/clear-receipt-concurrency
cd /tmp/clear-receipt-concurrency

printf '\n%s\n' 'Verify tenant-scoped request uniqueness'
psql -h 127.0.0.1 -U clear_ci -d clear_ci -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO "PaymentRequest" ("id", "organizationId", "requestId", "payloadHash", "orNumber", "outcomeJson")
VALUES ('tenant-a', 'a', 'same-request', 'hash-a', 'OR-A', '{}'),
       ('tenant-b', 'b', 'same-request', 'hash-b', 'OR-B', '{}');
INSERT INTO "PaymentRequest" ("id", "organizationId", "requestId", "payloadHash", "orNumber", "outcomeJson")
VALUES ('duplicate', 'a', 'same-request', 'changed', 'OR-C', '{}')
ON CONFLICT ("organizationId", "requestId") DO NOTHING;
SQL
test "$(psql -h 127.0.0.1 -U clear_ci -d clear_ci -Atc 'SELECT COUNT(*) FROM "PaymentRequest"')" = "2"

printf '\n%s\n' 'Check sequence uniqueness'
test "$(psql -h 127.0.0.1 -U clear_ci -d clear_ci -Atc "SELECT COUNT(DISTINCT n) FROM (SELECT nextval('clear_receipt_sequence') n FROM generate_series(1, 1000)) s")" = "1000"

printf '\n%s\n' 'Verify same-request cashier concurrency has one winner'
set -euo pipefail
psql -h 127.0.0.1 -U clear_ci -d clear_ci -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE cashier_posting_probe (
  request_id text NOT NULL,
  or_number text PRIMARY KEY
);
SQL
pids=()
for i in $(seq 1 20); do
  (
    psql -h 127.0.0.1 -U clear_ci -d clear_ci -v ON_ERROR_STOP=1 -qAt -c "
      WITH accepted AS (
        INSERT INTO \"PaymentRequest\" (
          \"id\", \"organizationId\", \"requestId\", \"payloadHash\", \"orNumber\", \"outcomeJson\"
        ) VALUES (
          'parallel-$i', 'parallel-tenant', 'parallel-request-id',
          'same-payload-hash', 'OR-RACE-$i', '{}'
        )
        ON CONFLICT (\"organizationId\", \"requestId\") DO NOTHING
        RETURNING \"requestId\", \"orNumber\"
      ), posted AS (
        INSERT INTO cashier_posting_probe (request_id, or_number)
        SELECT \"requestId\", \"orNumber\" FROM accepted
        RETURNING or_number
      )
      SELECT count(*) FROM posted
    " >"/tmp/cashier-race-$i"
  ) &
  pids+=("$!")
done
for pid in "${pids[@]}"; do wait "$pid"; done

test "$(psql -h 127.0.0.1 -U clear_ci -d clear_ci -Atc "SELECT count(*) FROM \"PaymentRequest\" WHERE \"organizationId\" = 'parallel-tenant' AND \"requestId\" = 'parallel-request-id'")" = "1"
test "$(psql -h 127.0.0.1 -U clear_ci -d clear_ci -Atc "SELECT count(*) FROM cashier_posting_probe")" = "1"
test "$(psql -h 127.0.0.1 -U clear_ci -d clear_ci -Atc "SELECT count(*) FROM cashier_posting_probe b JOIN \"PaymentRequest\" r ON b.request_id = r.\"requestId\" AND b.or_number = r.\"orNumber\" WHERE r.\"organizationId\" = 'parallel-tenant'")" = "1"
test "$(cat /tmp/cashier-race-* | awk '{s += $1} END {print s+0}')" = "1"

printf '\n%s\n' 'Verify sequence survives rollback without reuse'
psql -h 127.0.0.1 -U clear_ci -d clear_ci -v ON_ERROR_STOP=1 <<'SQL'
CREATE TEMP TABLE receipt_test (or_number bigint PRIMARY KEY);
INSERT INTO receipt_test SELECT nextval('clear_receipt_sequence') FROM generate_series(1, 100);
DO $$
DECLARE before_rollback bigint;
DECLARE after_rollback bigint;
BEGIN
  BEGIN
    before_rollback := nextval('clear_receipt_sequence');
    RAISE EXCEPTION 'intentional rollback';
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  after_rollback := nextval('clear_receipt_sequence');
  IF after_rollback <= before_rollback THEN
    RAISE EXCEPTION 'sequence value was reused after rollback';
  END IF;
END $$;
SQL

printf '\n%s\n' 'Verify parallel sessions issue distinct receipts'
seq 1 20 | xargs -P 10 -I {} sh -c 'psql -h 127.0.0.1 -U clear_ci -d clear_ci -Atc "SELECT nextval('\''clear_receipt_sequence'\'')"' | sort -n | uniq -d | tee /tmp/duplicate-or-sequences
test ! -s /tmp/duplicate-or-sequences

printf '\n%s\n' 'Verify transaction rollback removes receipt rows'
psql -h 127.0.0.1 -U clear_ci -d clear_ci -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE finance_rollback_probe (receipt_number bigint PRIMARY KEY, amount numeric NOT NULL);
BEGIN;
INSERT INTO finance_rollback_probe VALUES (nextval('clear_receipt_sequence'), 125.00);
ROLLBACK;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM finance_rollback_probe) THEN
    RAISE EXCEPTION 'rollback left a partial receipt';
  END IF;
END $$;
SQL

printf '\n%s\n' 'Verify concurrent remittance approval has one winner'
psql -h 127.0.0.1 -U clear_ci -d clear_ci -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE remittance_approval_probe (id integer PRIMARY KEY, status text NOT NULL, or_number bigint);
INSERT INTO remittance_approval_probe VALUES (1, 'Pending Verification', NULL);
SQL
for i in $(seq 1 20); do
  (psql -h 127.0.0.1 -U clear_ci -d clear_ci -qAtc "UPDATE remittance_approval_probe SET status = 'Verified', or_number = nextval('clear_receipt_sequence') WHERE id = 1 AND status = 'Pending Verification' RETURNING or_number" > "/tmp/remittance-approval-$i") &
done
wait
cat /tmp/remittance-approval-[0-9]* | sed '/^$/d' > /tmp/remittance-approval-results
test "$(wc -l < /tmp/remittance-approval-results)" -eq 1
test "$(psql -h 127.0.0.1 -U clear_ci -d clear_ci -Atc "SELECT COUNT(*) FROM remittance_approval_probe WHERE status = 'Verified' AND or_number IS NOT NULL")" -eq 1
