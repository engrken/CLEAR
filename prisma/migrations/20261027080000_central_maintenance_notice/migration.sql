-- P3 maintenance controls are inert by default. No INSERT here and no
-- modification to any existing financial, student or tenant records.
CREATE TABLE "MaintenancePolicy" (
  "scopeKey" TEXT NOT NULL PRIMARY KEY,
  "mode" TEXT NOT NULL DEFAULT 'NORMAL',
  "reason" TEXT NOT NULL DEFAULT '',
  "expiresAt" TIMESTAMPTZ(3),
  "updatedBy" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MaintenancePolicy_mode_check" CHECK ("mode" IN ('NORMAL', 'READ_ONLY', 'FULL'))
);
CREATE TABLE "MaintenanceNotice" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "scopeKey" TEXT NOT NULL,
  "title" VARCHAR(140) NOT NULL,
  "message" VARCHAR(800) NOT NULL,
  "startsAt" TIMESTAMPTZ(3) NOT NULL,
  "endsAt" TIMESTAMPTZ(3) NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdBy" TEXT NOT NULL,
  "updatedBy" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MaintenanceNotice_state_check" CHECK ("state" IN ('DRAFT','SCHEDULED','CANCELLED')),
  CONSTRAINT "MaintenanceNotice_dates_check" CHECK ("endsAt" > "startsAt")
);
CREATE INDEX "MaintenanceNotice_scopeKey_state_startsAt_endsAt_idx"
 ON "MaintenanceNotice"("scopeKey", "state", "startsAt", "endsAt");
CREATE TABLE "MaintenanceAudit" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "scopeKey" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "actor" TEXT NOT NULL,
  "before" JSONB,
  "after" JSONB,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "MaintenanceAudit_scopeKey_createdAt_idx"
 ON "MaintenanceAudit"("scopeKey", "createdAt");
