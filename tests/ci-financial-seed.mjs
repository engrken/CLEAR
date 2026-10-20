import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const ay = "A.Y. 2026 - 2027";
const term = "1st Sem";
try {
  const org = await prisma.organization.create({
    data: { subdomain: "ci-financial", name: "CI Financial QA",
      status: "Active", type: "Department", activeAy: ay, activeTerm: term },
  });
  await prisma.tenantUser.create({
    data: { organizationId: org.id, userId: "CI-FIN-OFFICER",
      fullName: "CI Test Officer", username: "ci_financial_officer",
      email: "ci-officer@example.invalid", role: "Admin", status: "Active",
      allowedTabs: JSON.stringify(["tab-payment", "tab-remittances"]) },
  });
  await prisma.student.create({
    data: { organizationId: org.id, studentId: "CI-FIN-STUDENT-001",
      fullName: "CI Synthetic Student", yearLevel: "1", email: null },
  });
  await prisma.academicPeriodConfig.create({
    data: { organizationId: org.id, academicYear: ay, mode: "Semester", includeSummer: true },
  });
  await prisma.fund.create({
    data: { organizationId: org.id, academicYear: ay, term,
      fundName: "General Fund", initialAllocation: 0, currentBalance: 0 },
  });
  await prisma.collectionSetup.create({
    data: { organizationId: org.id, academicYear: ay, term,
      category: "Membership", name: "Membership Fee", amount: 150,
      targetFund: "General Fund", isPackage: true },
  });
  // A real student-assessment marker must be reduced by both cashier and
  // online remittance receipts within their respective transactions.
  await prisma.collectible.create({
    data: { organizationId: org.id, academicYear: ay, term,
      category: "Membership", headcount: 1, balanceDue: 150,
      status: "Unpaid|SID:CI-FIN-STUDENT-001|ITEM:Membership%20Fee" },
  });
  await prisma.onlineRemittance.create({
    data: { organizationId: org.id, submissionId: "CI-FIN-REMIT-001",
      academicYear: ay, term, studentId: "CI-FIN-STUDENT-001",
      studentName: "CI Synthetic Student", paymentChannel: "GCash",
      referenceNumber: "CI-FIN-TRANSFER-001", category: "Online Remittance",
      itemDescription: "Membership Fee", paymentMode: "Online",
      amountPaid: 20, status: "Pending Verification" },
  });
  console.log("Synthetic finance tenant, officer, student, and pending remittance seeded in disposable CI database.");
} finally {
  await prisma.$disconnect();
}
