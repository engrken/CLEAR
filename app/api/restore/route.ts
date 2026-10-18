// Authenticated, tenant-scoped MERGE restore. Never imports tenant credentials or rewrites SystemLogs.
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isSuperAdminEmail } from '@/lib/permissions';
import { decryptClearBackup, InvalidBackupError, MissingBackupKeyError } from '@/lib/backup-security';

export const runtime = 'nodejs';
const MAX_BYTES = 12 * 1024 * 1024;
const MAX_ROWS = 10000;

type BackupRow = Record<string, unknown>;
const tableSpecs = [
  ['students','student','id studentId fullName yearLevel email'],
  ['enrollments','enrollment','id studentId academicYear term enrollmentStatus lastUpdated updatedBy'],
  ['funds','fund','id academicYear term fundName initialAllocation currentBalance'],
  ['collectionSetups','collectionSetup','id category name amount targetFund academicYear term createdAt isPackage'],
  ['signatories','signatory','id label name position order'],
  ['collections','collection','id timestamp academicYear term date studentId studentName orNumber category itemDescription paymentType standardRate amountPaid balanceDue fundAllocation status encodedBy'],
  ['collectibles','collectible','id category academicYear term headcount balanceDue status encodedBy'],
  ['penalties','penalty','id penaltyId academicYear term date studentId studentName activity hoursLate ratePerHour fineAmount status encodedBy'],
  ['cashAdvances','cashAdvance','id advanceId academicYear term dateIssued requestor fundSource amountApproved expectedReturnDate purpose status encodedBy'],
  ['audits','audit','id auditId academicYear term date referenceCaId requestor fundSource budgetRequested totalExpense varianceReturn reimbursementDue status encodedBy'],
  ['expenseItems','expenseItem','id auditId orSiNumber qty description subTotal receiptProofUrl'],
  ['onlineRemittances','onlineRemittance','id submissionId timestamp academicYear term studentId studentName studentEmail paymentChannel referenceNumber category itemDescription paymentMode amountPaid proofUrl status reviewNotes reviewedBy orNumber'],
  ['cashierRemittances','cashierRemittance','id remittanceId academicYear term date remittedBy fundSource amount cashierReceiptNo remarks status encodedBy createdAt type'],
  ['fundTransfers','fundTransfer','id timestamp academicYear term sourceFund destinationFund amount reason encodedBy'],
  ['realignments','fundRealignment','id date sourceFund targetFund amount reason authorizedBy'],
  ['voidTransactions','voidTransaction','id transactionType referenceId amount reason voidedBy date'],
] as const;

function response(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

function normalizeRows(data: Record<string, unknown>) {
  const tables: { key: string; model: string; rows: BackupRow[]; fields: Set<string> }[] = [];
  let count = 0;
  for (const [key, model, whitelist] of tableSpecs) {
    const value = data[key];
    if (value != null && !Array.isArray(value)) throw new Error(`Invalid ${key} array.`);
    const rows = (value ?? []) as unknown[];
    for (const row of rows) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error(`Invalid ${key} record.`);
    }
    count += rows.length;
    tables.push({ key, model, rows: rows as BackupRow[], fields: new Set(whitelist.split(' ')) });
  }
  if (count === 0) throw new Error('Backup has no restorable records.');
  if (count > MAX_ROWS) throw new Error(`This interactive restore is limited to ${MAX_ROWS} records. Use a controlled database restore for larger snapshots.`);
  return { tables, count };
}

export async function POST(req: Request) {
  try {
    // Reject obvious cross-site browser calls. SameSite cookies are not a substitute for checking Origin.
    const origin = req.headers.get('origin');
    if (origin && origin !== new URL(req.url).origin) return response('Invalid request origin.', 403);
    const session = await auth();
    if (!session?.user?.email) return response('Unauthorized.', 401);
    const caller = session.user as typeof session.user & { organizationId?: string | null };
    const email = String(caller.email).trim().toLowerCase();

    const form = await req.formData();
    const file = form.get('backupFile');
    const orgId = String(form.get('orgId') || '').trim();
    if (!(file instanceof File) || file.size === 0 || file.size > MAX_BYTES || !orgId) {
      return response('Choose an encrypted CLEAR backup no larger than 12 MB and a valid target organization.', 400);
    }
    const organization = await prisma.organization.findUnique({ where: { id: orgId }, select: { id: true, name: true } });
    if (!organization) return response('Target organization not found.', 404);

    const isSuper = isSuperAdminEmail(email);
    if (!isSuper) {
      if (caller.organizationId && caller.organizationId !== orgId) return response('Forbidden.', 403);
      const dbUser = await prisma.tenantUser.findFirst({
        where: { organizationId: orgId, email: { equals: email, mode: 'insensitive' }, status: 'Active' },
        select: { role: true },
      });
      if (!dbUser || !['admin', 'administrator', 'master'].includes(dbUser.role.trim().toLowerCase())) return response('Active department administrator access required.', 403);
    }

    // Verify authenticated encryption BEFORE preparing any database writes.
    // Modifying even a single bit of ciphertext/tag causes decryptClearBackup to reject the file.
    // Legacy plaintext JSON backups are not accepted by this public-facing restore endpoint.
    let backup: { organization?: { id?: string }; data?: Record<string, unknown>; version?: string };
    try {
      backup = decryptClearBackup(await file.text(), orgId);
    } catch (error) {
      if (error instanceof MissingBackupKeyError) return response('Server backup encryption key is not configured.', 503);
      return response('Backup rejected: encrypted file is invalid, modified, or belongs to another tenant.', 400);
    }
    if (!backup.organization || backup.organization.id !== orgId || !backup.data) {
      return response('Backup organization ID mismatch.', 400);
    }
    const { tables, count } = normalizeRows(backup.data);

    await prisma.$transaction(async tx => {
      // Each table is restored in dependency order. Records cannot migrate from another organization.
      for (const table of tables) {
        const delegate = (tx as any)[table.model];
        for (const row of table.rows) {
          const id = row.id;
          if (typeof id !== 'string' || !id || row.organizationId !== orgId) {
            throw new Error(`Invalid tenant ownership or record ID in ${table.key}.`);
          }
          const existing = await delegate.findUnique({ where: { id }, select: { organizationId: true } });
          if (existing && existing.organizationId !== orgId) {
            throw new Error(`Cross-tenant record collision in ${table.key}; restore aborted.`);
          }
          const data: Record<string, unknown> = { organizationId: orgId };
          for (const field of table.fields) {
            if (Object.prototype.hasOwnProperty.call(row, field)) data[field] = row[field];
          }
          // Reject references to student and audit rows from another tenant.
          if (['enrollments', 'collections'].includes(table.key) && data.studentId) {
            const owner = await tx.student.findFirst({ where: { id: String(data.studentId), organizationId: orgId }, select: { id: true } });
            if (!owner) throw new Error(`Student foreign key is invalid for ${table.key} record ${id}.`);
          }
          if (table.key === 'expenseItems') {
            const auditOwner = await tx.audit.findFirst({ where: { auditId: String(data.auditId), organizationId: orgId }, select: { id: true } });
            if (!auditOwner) throw new Error(`Audit foreign key is invalid for expense item ${id}.`);
          }
          await delegate.upsert({ where: { id }, create: data, update: data });
        }
      }
      // Do not accept backup-authored security logs. Add an immutable record of this import.
      await tx.systemLog.create({ data: {
        organizationId: orgId,
        user: email,
        action: 'RESTORE_DATABASE_BACKUP',
        details: `Merged ${count} records from authenticated encrypted snapshot ${backup.version || 'unknown version'}. Credentials and audit history were not imported.`,
      } });
    }, { timeout: 90000 });

    return NextResponse.json({ success: true, message: `${count} records merged into ${organization.name}. User accounts and existing system audit logs were not overwritten.` }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Backup restore rejected or failed:', error);
    const msg = error instanceof Error ? error.message : 'Backup restore failed.';
    const allowed = /Invalid|Cross-tenant|foreign key|tenant ownership|interactive restore|restorable|backup has/i.test(msg);
    return response(allowed ? msg : 'Restore failed. Check server logs and database integrity.', allowed ? 400 : 500);
  }
}
