-- Public self-service registration is isolated from existing tenant records.
CREATE TABLE IF NOT EXISTS "PublicOrganizationRegistration" (
 "id" TEXT PRIMARY KEY,
 "organizationName" VARCHAR(150) NOT NULL,
 "subdomain" VARCHAR(63) NOT NULL,
 "type" VARCHAR(32) NOT NULL,
 "adminName" VARCHAR(150) NOT NULL,
 "adminEmail" VARCHAR(254) NOT NULL UNIQUE,
 "academicYear" VARCHAR(32) NOT NULL,
 "calendarMode" VARCHAR(16) NOT NULL,
 "verificationHash" VARCHAR(64) NOT NULL,
 "expiresAt" TIMESTAMPTZ(3) NOT NULL,
 "verifiedAt" TIMESTAMPTZ(3),
 "lastSentAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "attempts" INTEGER NOT NULL DEFAULT 0,
 "sendCount" INTEGER NOT NULL DEFAULT 1,
 "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "PublicOrganizationRegistration_subdomain_idx" ON "PublicOrganizationRegistration" ("subdomain");
CREATE INDEX IF NOT EXISTS "PublicOrganizationRegistration_createdAt_idx" ON "PublicOrganizationRegistration" ("createdAt");
