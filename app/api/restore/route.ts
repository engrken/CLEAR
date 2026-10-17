// /app/api/restore/route.ts
//
// Restores a department's own JSON backup (from /api/backup) into that same
// department. Safety rules:
//   - caller must be an admin of the target department (or the Super Admin),
//     checked with the shared guard;
//   - the backup must come from the target department (no cross-tenant restores);
//   - every row is written with the target organizationId, and a row id that
//     already belongs to ANOTHER organization aborts the whole restore;
//   - references (a collection's student, an expense item's audit) must point
//     inside the department;
//   - rows are upserted, never deleted, inside one transaction.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdminRole, requireDepartmentAccess } from '@/lib/permissions';

const MAX_BACKUP_BYTES = 20 * 1024 * 1024;

class RestoreError extends Error {}

type Row = Record<string, unknown> & { id?: unknown };

function rowsOf(value: unknown): Row[] {
  return Array.isArray(value) ? value.filter((r): r is Row => !!r && typeof r === 'object' && typeof (r as Row).id === 'string') : [];
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('backupFile');
    const department = String(formData.get('department') || '').trim();
    const orgIdParam = String(formData.get('orgId') || '').trim();

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, message: 'Missing backup JSON file.' }, { status: 400 });
    }
    if (file.size > MAX_BACKUP_BYTES) {
      return NextResponse.json({ success: false, message: 'Backup file is larger than 20 MB.' }, { status: 413 });
    }

    // Resolve the target department, then authorize against it.
    const slug =
      department ||
      (orgIdParam
        ? (await prisma.organization.findUnique({ where: { id: orgIdParam }, select: { subdomain: true } }))?.subdomain
        : undefined);
    if (!slug) {
      return NextResponse.json({ success: false, message: 'Target organization not found.' }, { status: 404 });
    }

    let access;
    try {
      access = await requireDepartmentAccess('tab-setup', slug);
    } catch {
      return NextResponse.json({ success: false, message: 'Forbidden: restoring requires administrator access to this department.' }, { status: 403 });
    }
    const { user, org, isSuperAdmin } = access;
    if (!isSuperAdmin && !isAdminRole(user.role)) {
      return NextResponse.json({ success: false, message: 'Forbidden: only department administrators can restore backups.' }, { status: 403 });
    }

    let backup: { organization?: { id?: unknown }; data?: Record<string, unknown> };
    try {
      backup = JSON.parse(await file.text());
    } catch {
      return NextResponse.json({ success: false, message: 'Invalid JSON format in backup file.' }, { status: 400 });
    }
    if (!backup?.data || typeof backup.organization?.id !== 'string') {
      return NextResponse.json({ success: false, message: 'Invalid backup file structure.' }, { status: 400 });
    }
    if (backup.organization.id !== org.id) {
      return NextResponse.json(
        { success: false, message: `This backup belongs to a different organization. Only ${org.name}'s own backups can be restored here.` },
        { status: 400 }
      );
    }

    const d = backup.data;
    const orgId = org.id;
    const students = rowsOf(d.students);
    const audits = rowsOf(d.audits);
    const restoredStudentIds = new Set(students.map((s) => s.id as string));
    const restoredAuditIds = new Set(audits.map((a) => String(a.auditId)));

    let restored = 0;

    await prisma.$transaction(
      async (tx) => {
        // Upserts rows of one model, refusing ids owned by another organization.
        const upsertAll = async (model: string, rows: Row[], check?: (row: Row) => Promise<void>) => {
          type Delegate = {
            findUnique(args: { where: { id: unknown }; select: { organizationId: true } }): Promise<{ organizationId: string } | null>;
            upsert(args: { where: { id: unknown }; update: object; create: object }): Promise<unknown>;
          };
          const delegate = (tx as unknown as Record<string, Delegate>)[model];
          for (const raw of rows) {
            const { organizationId: _ignored, ...row } = raw;
            void _ignored;
            const existing = await delegate.findUnique({ where: { id: row.id }, select: { organizationId: true } });
            if (existing && existing.organizationId !== orgId) {
              throw new RestoreError(`Backup row ${model} ${String(row.id)} belongs to another organization. Restore aborted.`);
            }
            if (check) await check(row);
            const data = { ...row, organizationId: orgId };
            await delegate.upsert({ where: { id: row.id }, update: data, create: data });
            restored += 1;
          }
        };

        // A studentId must reference a student of this department.
        const studentInOrg = async (row: Row) => {
          const sid = row.studentId;
          if (sid == null || restoredStudentIds.has(String(sid))) return;
          const found = await tx.student.findFirst({ where: { id: String(sid), organizationId: orgId }, select: { id: true } });
          if (!found) throw new RestoreError(`A record references a student outside this department. Restore aborted.`);
        };
        const auditInOrg = async (row: Row) => {
          const aid = String(row.auditId ?? '');
          if (restoredAuditIds.has(aid)) return;
          const found = await tx.audit.findFirst({ where: { auditId: aid, organizationId: orgId }, select: { id: true } });
          if (!found) throw new RestoreError(`An expense item references an audit outside this department. Restore aborted.`);
        };

        await upsertAll('student', students);
        await upsertAll('fund', rowsOf(d.funds));
        await upsertAll('collectionSetup', rowsOf(d.collectionSetups));
        await upsertAll('signatory', rowsOf(d.signatories));
        await upsertAll('enrollment', rowsOf(d.enrollments), studentInOrg);
        await upsertAll('collection', rowsOf(d.collections), studentInOrg);
        await upsertAll('collectible', rowsOf(d.collectibles));
        await upsertAll('penalty', rowsOf(d.penalties));
        await upsertAll('cashAdvance', rowsOf(d.cashAdvances));
        await upsertAll('audit', audits);
        await upsertAll('expenseItem', rowsOf(d.expenseItems), auditInOrg);
        await upsertAll('onlineRemittance', rowsOf(d.onlineRemittances));
        await upsertAll('cashierRemittance', rowsOf(d.cashierRemittances));
        await upsertAll('voidTransaction', rowsOf(d.voidTransactions));
        await upsertAll('fundTransfer', rowsOf(d.fundTransfers));
        await upsertAll('fundRealignment', rowsOf(d.realignments));
      },
      { maxWait: 10_000, timeout: 120_000 }
    );

    await prisma.systemLog
      .create({
        data: {
          organizationId: orgId,
          user: user.fullName || user.email,
          action: 'RESTORE_DATABASE_BACKUP',
          details: `Restored ${restored} records from a backup of ${org.name}.`,
        },
      })
      .catch(() => {});

    return NextResponse.json({ success: true, message: `Backup for ${org.name} restored (${restored} records).` });
  } catch (error) {
    if (error instanceof RestoreError) {
      return NextResponse.json({ success: false, message: error.message }, { status: 400 });
    }
    console.error('Backup Restoration Error:', error);
    return NextResponse.json({ success: false, message: 'Restore failed. No changes were saved.' }, { status: 500 });
  }
}
