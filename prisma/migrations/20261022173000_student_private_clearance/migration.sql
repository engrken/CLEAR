-- Isolated student viewer credentials. No alteration to financial records.
-- NOT approved for production: rehearse in isolated Neon recovery branch first.
CREATE TABLE "StudentOtpChallenge" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentOtpChallenge_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StudentOtpChallenge_studentId_key" ON "StudentOtpChallenge"("studentId");
CREATE INDEX "StudentOtpChallenge_organizationId_idx" ON "StudentOtpChallenge"("organizationId");
ALTER TABLE "StudentOtpChallenge" ADD CONSTRAINT "StudentOtpChallenge_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentOtpChallenge" ADD CONSTRAINT "StudentOtpChallenge_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "StudentReadSession" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentReadSession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StudentReadSession_tokenHash_key" ON "StudentReadSession"("tokenHash");
CREATE INDEX "StudentReadSession_org_student_idx" ON "StudentReadSession"("organizationId", "studentId");
ALTER TABLE "StudentReadSession" ADD CONSTRAINT "StudentReadSession_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentReadSession" ADD CONSTRAINT "StudentReadSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "StudentAuthBudget" (
    "key" TEXT NOT NULL,
    "windowStart" TIMESTAMPTZ(3) NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "StudentAuthBudget_pkey" PRIMARY KEY ("key")
);
