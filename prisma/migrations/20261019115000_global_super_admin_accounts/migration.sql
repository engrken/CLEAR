-- CLEAR global platform operators. Preserve all existing TenantUser, VerificationToken
-- and SUPER_ADMIN_EMAIL workflows. Apply via prisma migrate deploy BEFORE app deploy.
CREATE TABLE "GlobalSuperAdmin" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "invitedBy" TEXT NOT NULL,
    "invitationExpiresAt" TIMESTAMPTZ(3) NOT NULL,
    "activatedAt" TIMESTAMPTZ(3),
    "disabledAt" TIMESTAMPTZ(3),
    "revokedAt" TIMESTAMPTZ(3),
    "sessionVersion" INTEGER NOT NULL DEFAULT 1,
    "lastLoginAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GlobalSuperAdmin_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "GlobalSuperAdmin_status_check" CHECK ("status" IN ('Pending','Active','Disabled','Revoked'))
);
CREATE UNIQUE INDEX "GlobalSuperAdmin_email_key" ON "GlobalSuperAdmin"("email");
CREATE INDEX "GlobalSuperAdmin_status_idx" ON "GlobalSuperAdmin"("status");
CREATE TABLE "GlobalAdminAudit" (
    "id" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "targetEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GlobalAdminAudit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "GlobalAdminAudit_createdAt_idx" ON "GlobalAdminAudit"("createdAt");
CREATE INDEX "GlobalAdminAudit_targetEmail_createdAt_idx" ON "GlobalAdminAudit"("targetEmail", "createdAt");
