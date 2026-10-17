-- SaaS tenancy fields and the daily OTP cap (merged from engrken/CLEAR).
-- Production may already have these columns from `prisma db push`, so every
-- statement is idempotent.

ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "schoolGroup" TEXT NOT NULL DEFAULT 'default-school';
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "tier" TEXT NOT NULL DEFAULT 'Freemium';
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'Active';
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "TenantUser" ADD COLUMN IF NOT EXISTS "otpRequestCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TenantUser" ADD COLUMN IF NOT EXISTS "otpLastRequestedAt" TIMESTAMP(3);
ALTER TABLE "TenantUser" ADD COLUMN IF NOT EXISTS "otpAttempts" INTEGER NOT NULL DEFAULT 0;
