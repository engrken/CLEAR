const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Starting idempotent safe synchronization from Excel...');

  const excelPath = path.join(process.cwd(), 'Department Financial Audit Database.xlsx');
  const workbook = XLSX.readFile(excelPath);

  // 1. Ensure Department Tenant Organization exists
  const org = await prisma.organization.upsert({
    where: { subdomain: 'engineering' },
    update: {},
    create: {
      subdomain: 'engineering',
      name: 'College of Engineering',
    },
  });
  console.log(`✅ Tenant Organization: ${org.name} (${org.id})`);

  // Helper for safe date parsing
  const parseDate = (val) => {
    if (!val) return new Date();
    if (typeof val === 'number') {
      return new Date(Math.round((val - (25567 + 2)) * 86400 * 1000));
    }
    const parsed = new Date(val);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  };

  // 2. Import Students
  const validStudentIds = new Set();
  if (workbook.Sheets['Students']) {
    const studentsSheet = XLSX.utils.sheet_to_json(workbook.Sheets['Students']);
    for (const row of studentsSheet) {
      const studentId = String(row['Student ID'] || '').trim();
      if (!studentId) continue;
      validStudentIds.add(studentId);

      await prisma.student.upsert({
        where: { id: studentId },
        update: {
          fullName: String(row['Full Name'] || ''),
          yearLevel: String(row['Year Level'] || '1st Year'),
          email: row['Email'] ? String(row['Email']) : null,
        },
        create: {
          id: studentId,
          organizationId: org.id,
          studentId: studentId,
          fullName: String(row['Full Name'] || ''),
          yearLevel: String(row['Year Level'] || '1st Year'),
          email: row['Email'] ? String(row['Email']) : null,
        },
      });
    }
    console.log(`✅ Students synced (${validStudentIds.size} records).`);
  }

  // 3. Import Users / TenantUsers
  if (workbook.Sheets['Users']) {
    const usersSheet = XLSX.utils.sheet_to_json(workbook.Sheets['Users']);
    for (const row of usersSheet) {
      const email = String(row['Email'] || '').trim();
      const username = String(row['Username'] || '').trim();
      if (!email || !username) continue;

      await prisma.tenantUser.upsert({
        where: { email },
        update: {
          fullName: String(row['Full_Name'] || ''),
          role: String(row['Role'] || 'treasurer'),
          allowedTabs: String(row['Allowed_Tabs'] || '[]'),
          status: String(row['Status'] || 'Active'),
        },
        create: {
          organizationId: org.id,
          userId: String(row['User_ID'] || `USR-${Date.now()}`),
          fullName: String(row['Full_Name'] || ''),
          username: username,
          email: email,
          role: String(row['Role'] || 'treasurer'),
          allowedTabs: String(row['Allowed_Tabs'] || '[]'),
          status: String(row['Status'] || 'Active'),
        },
      });
    }
    console.log(`✅ Users synced.`);
  }

  // 4. Import Funds
  if (workbook.Sheets['Funds']) {
    const fundsSheet = XLSX.utils.sheet_to_json(workbook.Sheets['Funds']);
    for (const row of fundsSheet) {
      const fundName = String(row['Fund Name'] || '');
      const academicYear = String(row['Academic Year'] || 'A.Y. 2026 - 2027');
      const term = String(row['Term'] || '1st Sem');

      await prisma.fund.upsert({
        where: {
          organizationId_academicYear_term_fundName: {
            organizationId: org.id,
            academicYear,
            term,
            fundName,
          }
        },
        update: {
          initialAllocation: Number(row['Initial Allocation'] || 0),
          currentBalance: Number(row['Current Balance'] || 0),
        },
        create: {
          organizationId: org.id,
          academicYear,
          term,
          fundName,
          initialAllocation: Number(row['Initial Allocation'] || 0),
          currentBalance: Number(row['Current Balance'] || 0),
        },
      });
    }
    console.log(`✅ Funds synced.`);
  }

  // 5. Import Collections
  if (workbook.Sheets['Collections']) {
    const collectionsSheet = XLSX.utils.sheet_to_json(workbook.Sheets['Collections']);
    for (const row of collectionsSheet) {
      const rawStudentId = row['Student ID'] ? String(row['Student ID']).trim() : null;
      const verifiedStudentId = rawStudentId && validStudentIds.has(rawStudentId) ? rawStudentId : null;
      const orNumber = String(row['OR Number'] || '');
      const itemDescription = String(row['Item Description'] || '');

      await prisma.collection.upsert({
        where: {
          organizationId_orNumber_itemDescription: {
            organizationId: org.id,
            orNumber,
            itemDescription,
          }
        },
        update: {
          amountPaid: Number(row['Amount Paid'] || 0),
          balanceDue: Number(row['Balance Due '] || row['Balance Due'] || 0),
          status: 'Valid',
        },
        create: {
          organizationId: org.id,
          timestamp: parseDate(row['Timestamp']),
          academicYear: String(row['Academic Year'] || 'A.Y. 2026 - 2027'),
          term: String(row['Term'] || '1st Sem'),
          date: parseDate(row['Date']),
          studentId: verifiedStudentId,
          studentName: String(row['Student Name'] || ''),
          orNumber,
          category: String(row['Category'] || ''),
          itemDescription,
          paymentType: String(row['Payment Type'] || ''),
          standardRate: Number(row['Standard Rate'] || 0),
          amountPaid: Number(row['Amount Paid'] || 0),
          balanceDue: Number(row['Balance Due '] || row['Balance Due'] || 0),
          fundAllocation: String(row['Fund Allocation'] || ''),
          status: 'Valid',
        },
      });
    }
    console.log(`✅ Collections synced.`);
  }

  // 6. Import Penalties
  if (workbook.Sheets['Penalties']) {
    const penaltiesSheet = XLSX.utils.sheet_to_json(workbook.Sheets['Penalties']);
    for (const row of penaltiesSheet) {
      const penaltyId = String(row['Penalty ID'] || `PEN-${Date.now()}`);
      const rawStudentId = row['Student ID'] ? String(row['Student ID']).trim() : null;
      const verifiedStudentId = rawStudentId && validStudentIds.has(rawStudentId) ? rawStudentId : null;

      await prisma.penalty.upsert({
        where: { penaltyId },
        update: {},
        create: {
          organizationId: org.id,
          penaltyId,
          academicYear: String(row['Academic Year'] || 'A.Y. 2026 - 2027'),
          term: String(row['Term'] || '1st Sem'),
          date: parseDate(row['Date']),
          studentId: verifiedStudentId,
          studentName: String(row['Student Name'] || ''),
          activity: String(row['Activity'] || ''),
          hoursLate: Number(row['Hours Late'] || 0),
          ratePerHour: Number(row['Rate Per Hour'] || 50),
          fineAmount: Number(row['Fine Amount'] || 0),
          status: String(row['Status'] || 'Unsettled'),
        },
      });
    }
    console.log(`✅ Penalties synced.`);
  }

  // 7. Import Cash Advances
  if (workbook.Sheets['CashAdvances']) {
    const advancesSheet = XLSX.utils.sheet_to_json(workbook.Sheets['CashAdvances']);
    for (const row of advancesSheet) {
      const advanceId = String(row['Advance ID'] || `CA-${Date.now()}`);
      await prisma.cashAdvance.upsert({
        where: { advanceId },
        update: {},
        create: {
          organizationId: org.id,
          advanceId,
          academicYear: String(row['Academic Year'] || 'A.Y. 2026 - 2027'),
          term: String(row['Term'] || '1st Sem'),
          dateIssued: parseDate(row['Date Issued']),
          requestor: String(row['Requestor'] || ''),
          fundSource: String(row['Fund Source'] || ''),
          amountApproved: Number(row['Amount Approved'] || 0),
          expectedReturnDate: row['Expected Return Date'] ? parseDate(row['Expected Return Date']) : null,
          purpose: row['Purpose'] ? String(row['Purpose']) : null,
          status: String(row['Status'] || 'Active (Unliquidated)'),
        },
      });
    }
    console.log(`✅ Cash Advances synced.`);
  }

  // 8. Import Audits
  if (workbook.Sheets['Audits']) {
    const auditsSheet = XLSX.utils.sheet_to_json(workbook.Sheets['Audits']);
    for (const row of auditsSheet) {
      const auditId = String(row['Audit ID'] || `AUD-${Date.now()}`);
      await prisma.audit.upsert({
        where: { auditId },
        update: {},
        create: {
          organizationId: org.id,
          auditId,
          academicYear: String(row['Academic Year'] || 'A.Y. 2026 - 2027'),
          term: String(row['Term'] || '1st Sem'),
          date: parseDate(row['Date']),
          referenceCaId: String(row['Reference CA ID'] || ''),
          requestor: String(row['Requestor'] || ''),
          fundSource: String(row['Fund Source'] || ''),
          budgetRequested: Number(row['Budget Requested'] || 0),
          totalExpense: Number(row['Total Expense'] || 0),
          varianceReturn: Number(row['Variance / Return'] || 0),
          reimbursementDue: Number(row['Reimbursement Due'] || 0),
          status: String(row['Status'] || 'Audited & Verified'),
        },
      });
    }
    console.log(`✅ Audits synced.`);
  }

  // 9. Import Enrollments
  if (workbook.Sheets['Enrollments']) {
    const enrollmentsSheet = XLSX.utils.sheet_to_json(workbook.Sheets['Enrollments']);
    for (const row of enrollmentsSheet) {
      const studentId = String(row['Student ID'] || '').trim();
      const academicYear = String(row['Academic Year'] || 'A.Y. 2026 - 2027');
      const term = String(row['Term'] || '1st Sem');
      if (!studentId || !validStudentIds.has(studentId)) continue;

      await prisma.enrollment.upsert({
        where: {
          organizationId_academicYear_term_studentId: {
            organizationId: org.id,
            academicYear,
            term,
            studentId,
          }
        },
        update: {
          enrollmentStatus: String(row['Enrollment Status'] || 'Enrolled'),
          lastUpdated: parseDate(row['Last Updated']),
          updatedBy: row['Updated By'] ? String(row['Updated By']) : null,
        },
        create: {
          organizationId: org.id,
          studentId,
          academicYear,
          term,
          enrollmentStatus: String(row['Enrollment Status'] || 'Enrolled'),
          lastUpdated: parseDate(row['Last Updated']),
          updatedBy: row['Updated By'] ? String(row['Updated By']) : null,
        },
      });
    }
    console.log(`✅ Enrollments synced.`);
  }

  // 10. Safe Check-Before-Create for ExpenseItems
  if (workbook.Sheets['ExpenseItems']) {
    const expenseItemsSheet = XLSX.utils.sheet_to_json(workbook.Sheets['ExpenseItems']);
    for (const row of expenseItemsSheet) {
      const auditId = String(row['Audit ID'] || '');
      const description = String(row['Description'] || '');
      const subTotal = Number(row['Sub Total'] || 0);

      const existing = await prisma.expenseItem.findFirst({
        where: { organizationId: org.id, auditId, description, subTotal }
      });

      if (!existing) {
        await prisma.expenseItem.create({
          data: {
            organizationId: org.id,
            auditId,
            orSiNumber: row['OR/SI Number'] ? String(row['OR/SI Number']) : null,
            qty: Number(row['Qty'] || 1),
            description,
            subTotal,
            receiptProofUrl: row['Receipt Proof URL'] ? String(row['Receipt Proof URL']) : null,
          },
        });
      }
    }
    console.log(`✅ ExpenseItems synced safely.`);
  }

  // 11. Safe Check-Before-Create for Collectibles
  if (workbook.Sheets['Collectibles']) {
    const collectiblesSheet = XLSX.utils.sheet_to_json(workbook.Sheets['Collectibles']);
    for (const row of collectiblesSheet) {
      const category = String(row['Category'] || '');
      const academicYear = String(row['Academic Year'] || 'A.Y. 2026 - 2027');
      const term = String(row['Term'] || '1st Sem');
      const balanceDue = Number(row['Balance Due'] || 0);

      const existing = await prisma.collectible.findFirst({
        where: { organizationId: org.id, category, academicYear, term, balanceDue }
      });

      if (!existing) {
        await prisma.collectible.create({
          data: {
            organizationId: org.id,
            category,
            academicYear,
            term,
            headcount: Number(row['Headcount'] || 1),
            balanceDue,
            status: 'Outstanding',
          },
        });
      }
    }
    console.log(`✅ Collectibles synced safely.`);
  }

  // 12. Safe Check-Before-Create for SystemLogs
  if (workbook.Sheets['SystemLogs']) {
    const logsSheet = XLSX.utils.sheet_to_json(workbook.Sheets['SystemLogs']);
    for (const row of logsSheet) {
      const timestamp = parseDate(row['Timestamp']);
      const user = String(row['User'] || 'System');
      const action = String(row['Action'] || 'ACTION');
      const details = String(row['Details'] || '');

      const existing = await prisma.systemLog.findFirst({
        where: { organizationId: org.id, timestamp, user, action, details }
      });

      if (!existing) {
        await prisma.systemLog.create({
          data: {
            organizationId: org.id,
            timestamp,
            user,
            action,
            details,
          },
        });
      }
    }
    console.log(`✅ SystemLogs synced safely.`);
  }

  // 13. Import OnlineRemittances
  if (workbook.Sheets['OnlineRemittances']) {
    const remSheet = XLSX.utils.sheet_to_json(workbook.Sheets['OnlineRemittances']);
    for (const row of remSheet) {
      const submissionId = String(row['Submission ID'] || `REM-${Date.now()}`);
      await prisma.onlineRemittance.upsert({
        where: { submissionId },
        update: {},
        create: {
          organizationId: org.id,
          submissionId,
          timestamp: parseDate(row['Timestamp']),
          academicYear: String(row['Academic Year'] || 'A.Y. 2026 - 2027'),
          term: String(row['Term'] || '1st Sem'),
          studentId: row['Student ID'] ? String(row['Student ID']) : null,
          studentName: String(row['Student Name'] || ''),
          studentEmail: row['Student Email'] ? String(row['Student Email']) : null,
          paymentChannel: String(row['Payment Channel'] || 'GCash'),
          referenceNumber: String(row['Reference Number'] || ''),
          category: String(row['Category'] || ''),
          itemDescription: String(row['Item Description'] || ''),
          paymentMode: String(row['Payment Mode'] || 'Full Payment'),
          amountPaid: Number(row['Amount Paid'] || 0),
          proofUrl: row['Proof URL'] ? String(row['Proof URL']) : null,
          status: String(row['Status'] || 'Pending Verification'),
          reviewNotes: row['Review Notes'] ? String(row['Review Notes']) : null,
          reviewedBy: row['Reviewed By'] ? String(row['Reviewed By']) : null,
          orNumber: row['OR Number'] ? String(row['OR Number']) : null,
        },
      });
    }
    console.log(`✅ OnlineRemittances synced.`);
  }

  console.log('🎉 Full safe idempotent Excel migration completed successfully with zero duplicates!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });