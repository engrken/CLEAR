-- Add page-level officer presence and per-role walkthrough completion.
ALTER TABLE "TenantUser" ADD COLUMN "onboardingSignature" TEXT;

CREATE TABLE "OfficerPagePresence" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "tenantUserId" TEXT NOT NULL,
  "pageKey" TEXT NOT NULL,
  "lastSeen" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OfficerPagePresence_tenantUserId_fkey"
    FOREIGN KEY ("tenantUserId") REFERENCES "TenantUser"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "OfficerPagePresence_organizationId_pageKey_lastSeen_idx"
  ON "OfficerPagePresence"("organizationId", "pageKey", "lastSeen");
CREATE INDEX "OfficerPagePresence_tenantUserId_lastSeen_idx"
  ON "OfficerPagePresence"("tenantUserId", "lastSeen");
