-- CLEAR schema-history reconciliation: model objects confirmed on production Neon main, 2026-10-20.
-- This migration is deliberately additive/idempotent for pre-existing production objects.
-- It restores reproducible clean installations after historical db push operations.
-- NEVER rewrite business calendar dates; see the guarded UTC event column handling below.
-- Apply via prisma migrate deploy only after isolated clean + production-clone tests.


-- Add missing application columns without modifying current production values.
ALTER TABLE "Organization"
  ADD COLUMN IF NOT EXISTS "schoolGroup" TEXT NOT NULL DEFAULT 'default-school',
  ADD COLUMN IF NOT EXISTS "tier" TEXT NOT NULL DEFAULT 'Freemium',
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'Active',
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "reportSchoolName" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "reportSchoolAddress" TEXT,
  ADD COLUMN IF NOT EXISTS "reportHeaderLeftLogo" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "reportHeaderRightLogo" VARCHAR(255);

ALTER TABLE "Penalty"
  ADD COLUMN IF NOT EXISTS "assessedAmount" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "penaltyType" TEXT NOT NULL DEFAULT 'SERVICE_ELIGIBLE';

ALTER TABLE "TenantUser"
  ADD COLUMN IF NOT EXISTS "otpAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "otpRequestCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "otpLastRequestedAt" TIMESTAMPTZ(3);


-- Production-equivalent AcademicPeriodConfig table (CREATE skipped if it already exists).
CREATE TABLE IF NOT EXISTS "AcademicPeriodConfig" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "academicYear" TEXT NOT NULL,
  "mode" TEXT NOT NULL DEFAULT 'Semester'::text,
  "includeSummer" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "AcademicPeriodConfig_pkey" PRIMARY KEY (id)
);


-- Production-equivalent AcademicPeriodTransition table (CREATE skipped if it already exists).
CREATE TABLE IF NOT EXISTS "AcademicPeriodTransition" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "sourceAY" TEXT NOT NULL,
  "sourceTerm" TEXT NOT NULL,
  "destinationAY" TEXT NOT NULL,
  "destinationTerm" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "transferId" TEXT,
  "feePolicy" TEXT NOT NULL DEFAULT 'manual'::text,
  "copiedFeesJson" TEXT NOT NULL DEFAULT '[]'::text,
  "reason" TEXT NOT NULL,
  "closedBy" TEXT NOT NULL,
  "closedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" TEXT NOT NULL DEFAULT 'Closed'::text,
  "reopenedAt" TIMESTAMPTZ(3),
  CONSTRAINT "AcademicPeriodTransition_pkey" PRIMARY KEY (id)
);


-- Production-equivalent ArrearPaymentLink table (CREATE skipped if it already exists).
CREATE TABLE IF NOT EXISTS "ArrearPaymentLink" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "receiptId" TEXT NOT NULL,
  "obligationType" TEXT NOT NULL,
  "obligationId" TEXT NOT NULL,
  "originAY" TEXT NOT NULL,
  "originTerm" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ArrearPaymentLink_pkey" PRIMARY KEY (id)
);


-- Production-equivalent PenaltySettlementEvent table (CREATE skipped if it already exists).
CREATE TABLE IF NOT EXISTS "PenaltySettlementEvent" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "penaltyRecordId" TEXT NOT NULL,
  "receiptId" TEXT,
  "method" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "minutesRendered" INTEGER NOT NULL DEFAULT 0,
  "accountingAY" TEXT NOT NULL,
  "accountingTerm" TEXT NOT NULL,
  "balanceBefore" DOUBLE PRECISION NOT NULL,
  "balanceAfter" DOUBLE PRECISION NOT NULL,
  "recordedBy" TEXT NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PenaltySettlementEvent_pkey" PRIMARY KEY (id)
);


-- Production-equivalent DigitalReceiptDelivery table (CREATE skipped if it already exists).
CREATE TABLE IF NOT EXISTS "DigitalReceiptDelivery" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "eventKey" TEXT NOT NULL,
  "documentType" TEXT NOT NULL,
  "referenceNo" TEXT NOT NULL,
  "recipientEmail" TEXT NOT NULL,
  "recipientRole" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "html" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'Pending'::text,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastError" TEXT,
  "sentAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DigitalReceiptDelivery_pkey" PRIMARY KEY (id)
);


-- Production-equivalent TransactionEmailPreference table (CREATE skipped if it already exists).
CREATE TABLE IF NOT EXISTS "TransactionEmailPreference" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "receiveParticipantEmails" BOOLEAN NOT NULL DEFAULT true,
  "receiveOfficerCopies" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TransactionEmailPreference_pkey" PRIMARY KEY (id)
);


-- Upgrade event/OTP timestamps from legacy TIMESTAMP to TIMESTAMPTZ(3)
-- ONLY when the containing table is empty (the clean-install case).
-- Populated legacy tables require separately reviewed history-preserving
-- conversions: never let PostgreSQL guess the original event timezone.
-- Calendar-only business dates (Penalty.date, Collection.date, etc.) are
-- intentionally NOT included.
DO $clear_timestamps$
DECLARE
  r record;
  actual_type text;
  has_rows boolean;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('AuthThrottle', 'lockedUntil'),
    ('AuthThrottle', 'lastSentAt'),
    ('AuthThrottle', 'updatedAt'),
    ('CashierRemittance', 'createdAt'),
    ('Collection', 'timestamp'),
    ('CollectionSetup', 'createdAt'),
    ('Enrollment', 'lastUpdated'),
    ('FundTransfer', 'timestamp'),
    ('MobileSession', 'createdAt'),
    ('MobileSession', 'expiresAt'),
    ('MobileSession', 'lastUsedAt'),
    ('MobileSession', 'revokedAt'),
    ('OnlineRemittance', 'timestamp'),
    ('Organization', 'createdAt'),
    ('SystemLog', 'timestamp'),
    ('TenantUser', 'otpExpires'),
    ('TenantUser', 'updatedAt'),
    ('VerificationToken', 'expires'),
    ('VoidTransaction', 'date')
  ) AS t(table_name, column_name)
  LOOP
    SELECT c.data_type INTO actual_type
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = r.table_name
      AND c.column_name = r.column_name;
    IF actual_type IS NULL THEN
      RAISE EXCEPTION 'Missing required event column %.% while reconciling schema', r.table_name, r.column_name;
    END IF;
    IF actual_type = 'timestamp without time zone' THEN
      EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I)', r.table_name) INTO has_rows;
      IF has_rows THEN
        RAISE EXCEPTION 'Refusing timezone conversion of populated legacy %.%; review stored timezone semantics first',
          r.table_name, r.column_name;
      END IF;
      EXECUTE format(
        'ALTER TABLE %I ALTER COLUMN %I TYPE TIMESTAMPTZ(3) USING (%I AT TIME ZONE ''UTC'')',
        r.table_name, r.column_name, r.column_name
      );
    ELSIF actual_type <> 'timestamp with time zone' THEN
      RAISE EXCEPTION 'Unexpected type for %.%: %', r.table_name, r.column_name, actual_type;
    END IF;
  END LOOP;
END
$clear_timestamps$;


CREATE UNIQUE INDEX IF NOT EXISTS "AcademicPeriodConfig_organizationId_academicYear_key" ON public."AcademicPeriodConfig" USING btree ("organizationId", "academicYear");

CREATE INDEX IF NOT EXISTS "AcademicPeriodConfig_organizationId_idx" ON public."AcademicPeriodConfig" USING btree ("organizationId");

CREATE INDEX IF NOT EXISTS "APT_org_destination_period_idx" ON public."AcademicPeriodTransition" USING btree ("organizationId", "destinationAY", "destinationTerm");

CREATE UNIQUE INDEX IF NOT EXISTS "AcademicPeriodTransition_organizationId_sourceAY_sourceTerm_key" ON public."AcademicPeriodTransition" USING btree ("organizationId", "sourceAY", "sourceTerm");

CREATE INDEX IF NOT EXISTS "APL_org_obligation_idx" ON public."ArrearPaymentLink" USING btree ("organizationId", "obligationType", "obligationId");

CREATE UNIQUE INDEX IF NOT EXISTS "ArrearPaymentLink_receiptId_key" ON public."ArrearPaymentLink" USING btree ("receiptId");

CREATE INDEX IF NOT EXISTS "PSE_org_penalty_date_idx" ON public."PenaltySettlementEvent" USING btree ("organizationId", "penaltyRecordId", "createdAt");

CREATE INDEX IF NOT EXISTS "PSE_org_receipt_idx" ON public."PenaltySettlementEvent" USING btree ("organizationId", "receiptId");

CREATE INDEX IF NOT EXISTS "DRD_org_created_idx" ON public."DigitalReceiptDelivery" USING btree ("organizationId", "createdAt");

CREATE INDEX IF NOT EXISTS "DRD_retry_queue_idx" ON public."DigitalReceiptDelivery" USING btree (status, "nextAttemptAt");

CREATE UNIQUE INDEX IF NOT EXISTS "DRD_unique_delivery" ON public."DigitalReceiptDelivery" USING btree ("organizationId", "eventKey", "recipientEmail");

CREATE UNIQUE INDEX IF NOT EXISTS "TEP_org_email_unique" ON public."TransactionEmailPreference" USING btree ("organizationId", email);

CREATE INDEX IF NOT EXISTS "TEP_org_idx" ON public."TransactionEmailPreference" USING btree ("organizationId");

CREATE INDEX IF NOT EXISTS "Penalty_org_student_history_idx" ON "Penalty"("organizationId", "studentId", "academicYear", "term");

DO $clear_fk$
BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM pg_constraint
   WHERE conrelid = 'public."AcademicPeriodConfig"'::regclass
     AND conname = 'AcademicPeriodConfig_organizationId_fkey'
 ) THEN
  ALTER TABLE "AcademicPeriodConfig" ADD CONSTRAINT "AcademicPeriodConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;
 END IF;
END
$clear_fk$;

DO $clear_fk$
BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM pg_constraint
   WHERE conrelid = 'public."AcademicPeriodTransition"'::regclass
     AND conname = 'AcademicPeriodTransition_organizationId_fkey'
 ) THEN
  ALTER TABLE "AcademicPeriodTransition" ADD CONSTRAINT "AcademicPeriodTransition_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;
 END IF;
END
$clear_fk$;

DO $clear_fk$
BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM pg_constraint
   WHERE conrelid = 'public."ArrearPaymentLink"'::regclass
     AND conname = 'ArrearPaymentLink_organizationId_fkey'
 ) THEN
  ALTER TABLE "ArrearPaymentLink" ADD CONSTRAINT "ArrearPaymentLink_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;
 END IF;
END
$clear_fk$;

DO $clear_fk$
BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM pg_constraint
   WHERE conrelid = 'public."ArrearPaymentLink"'::regclass
     AND conname = 'ArrearPaymentLink_receiptId_fkey'
 ) THEN
  ALTER TABLE "ArrearPaymentLink" ADD CONSTRAINT "ArrearPaymentLink_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Collection"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
 END IF;
END
$clear_fk$;

DO $clear_fk$
BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM pg_constraint
   WHERE conrelid = 'public."DigitalReceiptDelivery"'::regclass
     AND conname = 'DRD_organization_fk'
 ) THEN
  ALTER TABLE "DigitalReceiptDelivery" ADD CONSTRAINT "DRD_organization_fk" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;
 END IF;
END
$clear_fk$;

DO $clear_fk$
BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM pg_constraint
   WHERE conrelid = 'public."PenaltySettlementEvent"'::regclass
     AND conname = 'PenaltySettlementEvent_organizationId_fkey'
 ) THEN
  ALTER TABLE "PenaltySettlementEvent" ADD CONSTRAINT "PenaltySettlementEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;
 END IF;
END
$clear_fk$;

DO $clear_fk$
BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM pg_constraint
   WHERE conrelid = 'public."PenaltySettlementEvent"'::regclass
     AND conname = 'PenaltySettlementEvent_penaltyRecordId_fkey'
 ) THEN
  ALTER TABLE "PenaltySettlementEvent" ADD CONSTRAINT "PenaltySettlementEvent_penaltyRecordId_fkey" FOREIGN KEY ("penaltyRecordId") REFERENCES "Penalty"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
 END IF;
END
$clear_fk$;

DO $clear_fk$
BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM pg_constraint
   WHERE conrelid = 'public."PenaltySettlementEvent"'::regclass
     AND conname = 'PenaltySettlementEvent_receiptId_fkey'
 ) THEN
  ALTER TABLE "PenaltySettlementEvent" ADD CONSTRAINT "PenaltySettlementEvent_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Collection"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
 END IF;
END
$clear_fk$;

DO $clear_fk$
BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM pg_constraint
   WHERE conrelid = 'public."TransactionEmailPreference"'::regclass
     AND conname = 'TEP_org_fk'
 ) THEN
  ALTER TABLE "TransactionEmailPreference" ADD CONSTRAINT "TEP_org_fk" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;
 END IF;
END
$clear_fk$;
