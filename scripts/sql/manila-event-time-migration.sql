-- LEGACY UTC-PROVENANCE SCRIPT IS DISABLED FOR CLEAR'S MIXED-HISTORY DATA.
-- It has been superseded by scripts/sql/manila-future-only-event-time-migration.sql.
-- DO NOT RUN IT. Its historical UTC premise has been disproven by backup records.
-- CLEAR 2026: REVIEW-GATED event instant type migration.
-- DO NOT RUN ON PRODUCTION WITHOUT VERIFIED BACKUP AND HISTORICAL-TIME AUDIT.
-- This script converts ONLY true event instants, not accounting/calendar dates.
-- It ASSUMES existing naive timestamp values represent UTC clock values.
-- If historical values are Manila-local or mixed, STOP and design a different migration.
--
-- Review docs/manila-time-rollout.md and use a restored staging snapshot first.
-- For a verified UTC-naive source, execute in the same PostgreSQL SQL session:
-- SELECT set_config('clear.verified_legacy_timestamp_zone','UTC',false);
-- followed by this script. The flag does NOT verify data by itself.

BEGIN;
DO $disabled_old_utc_migration$ BEGIN RAISE EXCEPTION 'Obsolete CLEAR UTC-only migration is disabled; use reviewed future-only waiver migration'; END $disabled_old_utc_migration$;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '15min';
SET LOCAL TIME ZONE 'UTC';

DO $$
DECLARE
  rec RECORD;
  observed_type TEXT;
BEGIN
  IF current_setting('clear.verified_legacy_timestamp_zone', true) IS DISTINCT FROM 'UTC' THEN
    RAISE EXCEPTION 'CLEAR migration blocked: verify original timestamp meaning, then explicitly set clear.verified_legacy_timestamp_zone=UTC for this session';
  END IF;

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

    IF observed_type = 'timestamp without time zone' THEN
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN %I TYPE timestamptz(3) USING %I AT TIME ZONE %L',
        rec.table_name, rec.column_name, rec.column_name, 'UTC'
      );
    ELSIF observed_type = 'timestamp with time zone' THEN
      -- Already migrated; do not reinterpret instants.
      RAISE NOTICE 'Already timestamptz: %.%', rec.table_name, rec.column_name;
    ELSE
      RAISE EXCEPTION 'Unexpected or missing column %.% (type: %)', rec.table_name, rec.column_name, observed_type;
    END IF;
  END LOOP;
END $$;

COMMIT;

-- Post-migration read-only verification:
-- SELECT "timestamp",
--        "timestamp" AT TIME ZONE 'Asia/Manila' AS pht
-- FROM "SystemLog" ORDER BY "timestamp" DESC LIMIT 10;
