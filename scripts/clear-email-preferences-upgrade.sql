-- Additive schema change. Execute on Neon STAGING first. No financial data modified.
BEGIN;
CREATE TABLE IF NOT EXISTS public."TransactionEmailPreference" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "receiveParticipantEmails" BOOLEAN NOT NULL DEFAULT TRUE,
  "receiveOfficerCopies" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TEP_org_fk" FOREIGN KEY ("organizationId")
    REFERENCES public."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "TEP_org_email_unique" ON public."TransactionEmailPreference" ("organizationId", "email");
CREATE INDEX IF NOT EXISTS "TEP_org_idx" ON public."TransactionEmailPreference" ("organizationId");
COMMIT;
