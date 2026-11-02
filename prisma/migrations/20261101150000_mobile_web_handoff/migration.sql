-- Storage only. No ticket issuance or redemption is enabled by this migration.
CREATE TABLE "MobileWebHandoff" (
  "id" TEXT NOT NULL,
  "ticketHash" VARCHAR(64) NOT NULL,
  "principalType" VARCHAR(16) NOT NULL,
  "principalId" TEXT NOT NULL,
  "organizationId" TEXT,
  "mobileSessionId" TEXT NOT NULL,
  "destination" VARCHAR(256) NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "consumedAt" TIMESTAMPTZ(3),
  "revokedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MobileWebHandoff_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MobileWebHandoff_principal_type_check" CHECK ("principalType" IN ('officer', 'global')),
  CONSTRAINT "MobileWebHandoff_principal_tenant_check" CHECK (
    ("principalType" = 'officer' AND "organizationId" IS NOT NULL) OR
    ("principalType" = 'global' AND "organizationId" IS NULL)
  ),
  CONSTRAINT "MobileWebHandoff_expiry_check" CHECK ("expiresAt" > "createdAt" AND "expiresAt" <= "createdAt" + INTERVAL '60 seconds')
);
CREATE UNIQUE INDEX "MobileWebHandoff_ticketHash_key" ON "MobileWebHandoff"("ticketHash");
CREATE INDEX "MobileWebHandoff_principalType_principalId_createdAt_idx" ON "MobileWebHandoff"("principalType", "principalId", "createdAt");
CREATE INDEX "MobileWebHandoff_mobileSessionId_consumedAt_idx" ON "MobileWebHandoff"("mobileSessionId", "consumedAt");
CREATE INDEX "MobileWebHandoff_expiresAt_idx" ON "MobileWebHandoff"("expiresAt");
