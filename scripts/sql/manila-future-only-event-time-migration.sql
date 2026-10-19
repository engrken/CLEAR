-- CLEAR FUTURE-ONLY timestamp standardization (test-data-history waiver).
-- KEEP OUTSIDE prisma/migrations: run ONLY in a coordinated manual DDL release.
-- Legacy data is MIXED UTC/Asia-Manila naive; user waived its accurate historical clock.
-- Using AT TIME ZONE 'UTC' for ALL old naive event fields deliberately mislabels
-- some old TEST events by +8h PHT. It does not adjust financial amounts or business dates.
-- NEW event defaults store true instants in timestamptz(3), formatted Asia/Manila in the UI.
-- IMPORTANT: DO NOT run this against production without separate release authorization,
-- financial write freeze, current fresh snapshot and read-only preflight checks.
--
-- Required *same SQL session*, only AFTER accepting test-history inaccuracy:
-- SELECT set_config('clear.future_only_test_history_waiver',
--   'ACCEPT_INACCURATE_LEGACY_TEST_TIMES', false);
-- Then execute THIS file. Guard acknowledgment is NOT historical UTC verification.
-- This is a one-time migration: it ABORTS if any of 33 fields are already timestamptz.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '15min';
SET LOCAL TIME ZONE 'UTC';

DO $clear_future_only$
DECLARE
  rec RECORD;
  observed_type TEXT;
BEGIN
  IF current_setting('clear.future_only_test_history_waiver', true)
      IS DISTINCT FROM 'ACCEPT_INACCURATE_LEGACY_TEST_TIMES' THEN
    RAISE EXCEPTION
      'CLEAR future-only cutover refused: acknowledge disposable mixed-origin historical TEST timestamps in the same session';
  END IF;

  -- ALL fields must be unmigrated before any ALTER TABLE.
  FOR rec IN
    SELECT * FROM (VALUES
      ('Organization', 'createdAt'),
      ('Organization', 'updatedAt'),
      ('Enrollment', 'lastUpdated'),
      ('Collection', 'timestamp'),
      ('CollectionSetup', 'createdAt'),
      ('OnlineRemittance', 'timestamp'),
      ('FundTransfer', 'timestamp'),
      ('SystemLog', 'timestamp'),
      ('TenantUser', 'otpExpires'),
      ('TenantUser', 'otpLastRequestedAt'),
      ('TenantUser', 'updatedAt'),
      ('VerificationToken', 'expires'),
      ('VoidTransaction', 'date'),
      ('CashierRemittance', 'createdAt'),
      ('AuthThrottle', 'lockedUntil'),
      ('AuthThrottle', 'lastSentAt'),
      ('AuthThrottle', 'updatedAt'),
      ('MobileSession', 'createdAt'),
      ('MobileSession', 'expiresAt'),
      ('MobileSession', 'lastUsedAt'),
      ('MobileSession', 'revokedAt'),
      ('AcademicPeriodConfig', 'createdAt'),
      ('AcademicPeriodConfig', 'updatedAt'),
      ('AcademicPeriodTransition', 'closedAt'),
      ('AcademicPeriodTransition', 'reopenedAt'),
      ('ArrearPaymentLink', 'createdAt'),
      ('PenaltySettlementEvent', 'createdAt'),
      ('DigitalReceiptDelivery', 'nextAttemptAt'),
      ('DigitalReceiptDelivery', 'sentAt'),
      ('DigitalReceiptDelivery', 'createdAt'),
      ('DigitalReceiptDelivery', 'updatedAt'),
      ('TransactionEmailPreference', 'createdAt'),
      ('TransactionEmailPreference', 'updatedAt')
    ) AS candidate(table_name, column_name)
  LOOP
    SELECT c.data_type INTO observed_type
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = rec.table_name
      AND c.column_name = rec.column_name;

    IF observed_type IS DISTINCT FROM 'timestamp without time zone' THEN
      RAISE EXCEPTION 'CLEAR schema preflight mismatch: %.% is %, expected timestamp without time zone',
        rec.table_name, rec.column_name, observed_type;
    END IF;
  END LOOP;

  FOR rec IN
    SELECT * FROM (VALUES
      ('Organization', 'createdAt'),
      ('Organization', 'updatedAt'),
      ('Enrollment', 'lastUpdated'),
      ('Collection', 'timestamp'),
      ('CollectionSetup', 'createdAt'),
      ('OnlineRemittance', 'timestamp'),
      ('FundTransfer', 'timestamp'),
      ('SystemLog', 'timestamp'),
      ('TenantUser', 'otpExpires'),
      ('TenantUser', 'otpLastRequestedAt'),
      ('TenantUser', 'updatedAt'),
      ('VerificationToken', 'expires'),
      ('VoidTransaction', 'date'),
      ('CashierRemittance', 'createdAt'),
      ('AuthThrottle', 'lockedUntil'),
      ('AuthThrottle', 'lastSentAt'),
      ('AuthThrottle', 'updatedAt'),
      ('MobileSession', 'createdAt'),
      ('MobileSession', 'expiresAt'),
      ('MobileSession', 'lastUsedAt'),
      ('MobileSession', 'revokedAt'),
      ('AcademicPeriodConfig', 'createdAt'),
      ('AcademicPeriodConfig', 'updatedAt'),
      ('AcademicPeriodTransition', 'closedAt'),
      ('AcademicPeriodTransition', 'reopenedAt'),
      ('ArrearPaymentLink', 'createdAt'),
      ('PenaltySettlementEvent', 'createdAt'),
      ('DigitalReceiptDelivery', 'nextAttemptAt'),
      ('DigitalReceiptDelivery', 'sentAt'),
      ('DigitalReceiptDelivery', 'createdAt'),
      ('DigitalReceiptDelivery', 'updatedAt'),
      ('TransactionEmailPreference', 'createdAt'),
      ('TransactionEmailPreference', 'updatedAt')
    ) AS candidate(table_name, column_name)
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN %I TYPE timestamptz(3) USING %I AT TIME ZONE %L',
      rec.table_name, rec.column_name, rec.column_name, 'UTC'
    );
  END LOOP;
END
$clear_future_only$;

COMMIT;

-- New event should store the current real instant. SQL read-only verification:
-- SELECT "timestamp" AT TIME ZONE 'Asia/Manila' AS pht
-- FROM "SystemLog" ORDER BY "timestamp" DESC LIMIT 1;
-- Old local test timestamp display accuracy is intentionally NOT guaranteed.
