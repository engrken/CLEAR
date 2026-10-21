-- Separate revocable global-superadmin sessions from tenant officer sessions.
-- Tokens are stored only as SHA-256 hashes; no officer/organization FK exists.
CREATE TABLE "GlobalMobileSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "adminEmail" TEXT NOT NULL,
    "globalAdminId" TEXT NOT NULL,
    "globalAdminVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "lastUsedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMPTZ(3),
    "userAgent" TEXT,
    CONSTRAINT "GlobalMobileSession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GlobalMobileSession_tokenHash_key" ON "GlobalMobileSession"("tokenHash");
CREATE INDEX "GlobalMobileSession_adminEmail_idx" ON "GlobalMobileSession"("adminEmail");
CREATE INDEX "GlobalMobileSession_expiresAt_idx" ON "GlobalMobileSession"("expiresAt");
