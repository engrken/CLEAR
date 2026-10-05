-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "subdomain" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "yearLevel" TEXT NOT NULL,
    "email" TEXT,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL DEFAULT 'A.Y. 2026 - 2027',
    "term" TEXT NOT NULL DEFAULT '1st Sem',
    "enrollmentStatus" TEXT NOT NULL DEFAULT 'Enrolled',
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fund" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL DEFAULT 'A.Y. 2026 - 2027',
    "term" TEXT NOT NULL DEFAULT '1st Sem',
    "fundName" TEXT NOT NULL,
    "initialAllocation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currentBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "Fund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "academicYear" TEXT NOT NULL DEFAULT 'A.Y. 2026 - 2027',
    "term" TEXT NOT NULL DEFAULT '1st Sem',
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "studentId" TEXT,
    "studentName" TEXT NOT NULL,
    "orNumber" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "itemDescription" TEXT NOT NULL,
    "paymentType" TEXT NOT NULL,
    "standardRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amountPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "balanceDue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fundAllocation" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Valid',
    "encodedBy" TEXT,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Penalty" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "penaltyId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL DEFAULT 'A.Y. 2026 - 2027',
    "term" TEXT NOT NULL DEFAULT '1st Sem',
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "studentId" TEXT,
    "studentName" TEXT NOT NULL,
    "activity" TEXT NOT NULL,
    "hoursLate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ratePerHour" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "fineAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Unsettled',
    "encodedBy" TEXT,

    CONSTRAINT "Penalty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashAdvance" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "advanceId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL DEFAULT 'A.Y. 2026 - 2027',
    "term" TEXT NOT NULL DEFAULT '1st Sem',
    "dateIssued" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestor" TEXT NOT NULL,
    "fundSource" TEXT NOT NULL,
    "amountApproved" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expectedReturnDate" TIMESTAMP(3),
    "purpose" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active (Unliquidated)',
    "encodedBy" TEXT,

    CONSTRAINT "CashAdvance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Audit" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL DEFAULT 'A.Y. 2026 - 2027',
    "term" TEXT NOT NULL DEFAULT '1st Sem',
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "referenceCaId" TEXT NOT NULL,
    "requestor" TEXT NOT NULL,
    "fundSource" TEXT NOT NULL,
    "budgetRequested" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalExpense" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "varianceReturn" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reimbursementDue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Audited & Verified',
    "encodedBy" TEXT,

    CONSTRAINT "Audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "orSiNumber" TEXT,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT NOT NULL,
    "subTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "receiptProofUrl" TEXT,

    CONSTRAINT "ExpenseItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Collectible" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL DEFAULT 'A.Y. 2026 - 2027',
    "term" TEXT NOT NULL DEFAULT '1st Sem',
    "headcount" INTEGER NOT NULL DEFAULT 1,
    "balanceDue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Outstanding',
    "encodedBy" TEXT,

    CONSTRAINT "Collectible_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnlineRemittance" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "academicYear" TEXT NOT NULL DEFAULT 'A.Y. 2026 - 2027',
    "term" TEXT NOT NULL DEFAULT '1st Sem',
    "studentId" TEXT,
    "studentName" TEXT NOT NULL,
    "studentEmail" TEXT,
    "paymentChannel" TEXT NOT NULL,
    "referenceNumber" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "itemDescription" TEXT NOT NULL,
    "paymentMode" TEXT NOT NULL,
    "amountPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "proofUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Pending Verification',
    "reviewNotes" TEXT,
    "reviewedBy" TEXT,
    "orNumber" TEXT,

    CONSTRAINT "OnlineRemittance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FundTransfer" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "academicYear" TEXT NOT NULL DEFAULT 'A.Y. 2026 - 2027',
    "term" TEXT NOT NULL DEFAULT '1st Sem',
    "sourceFund" TEXT NOT NULL,
    "destinationFund" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL,
    "encodedBy" TEXT,

    CONSTRAINT "FundTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,

    CONSTRAINT "SystemLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantUser" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "allowedTabs" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "otpCode" TEXT,
    "otpExpires" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("identifier")
);

-- CreateTable
CREATE TABLE "VoidTransaction" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "transactionType" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "voidedBy" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoidTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FundRealignment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceFund" TEXT NOT NULL,
    "targetFund" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "authorizedBy" TEXT NOT NULL,

    CONSTRAINT "FundRealignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_subdomain_key" ON "Organization"("subdomain");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_organizationId_academicYear_term_studentId_key" ON "Enrollment"("organizationId", "academicYear", "term", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Fund_organizationId_academicYear_term_fundName_key" ON "Fund"("organizationId", "academicYear", "term", "fundName");

-- CreateIndex
CREATE UNIQUE INDEX "Collection_organizationId_orNumber_itemDescription_key" ON "Collection"("organizationId", "orNumber", "itemDescription");

-- CreateIndex
CREATE UNIQUE INDEX "Penalty_penaltyId_key" ON "Penalty"("penaltyId");

-- CreateIndex
CREATE UNIQUE INDEX "CashAdvance_advanceId_key" ON "CashAdvance"("advanceId");

-- CreateIndex
CREATE UNIQUE INDEX "Audit_auditId_key" ON "Audit"("auditId");

-- CreateIndex
CREATE UNIQUE INDEX "OnlineRemittance_submissionId_key" ON "OnlineRemittance"("submissionId");

-- CreateIndex
CREATE INDEX "SystemLog_organizationId_timestamp_idx" ON "SystemLog"("organizationId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "TenantUser_organizationId_userId_key" ON "TenantUser"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantUser_organizationId_username_key" ON "TenantUser"("organizationId", "username");

-- CreateIndex
CREATE UNIQUE INDEX "TenantUser_organizationId_email_key" ON "TenantUser"("organizationId", "email");

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fund" ADD CONSTRAINT "Fund_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Penalty" ADD CONSTRAINT "Penalty_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashAdvance" ADD CONSTRAINT "CashAdvance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Audit" ADD CONSTRAINT "Audit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseItem" ADD CONSTRAINT "ExpenseItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseItem" ADD CONSTRAINT "ExpenseItem_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("auditId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collectible" ADD CONSTRAINT "Collectible_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnlineRemittance" ADD CONSTRAINT "OnlineRemittance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundTransfer" ADD CONSTRAINT "FundTransfer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemLog" ADD CONSTRAINT "SystemLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantUser" ADD CONSTRAINT "TenantUser_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoidTransaction" ADD CONSTRAINT "VoidTransaction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundRealignment" ADD CONSTRAINT "FundRealignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
