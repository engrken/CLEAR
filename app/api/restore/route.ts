// /app/api/restore/route.ts

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isSuperAdminEmail } from '@/lib/permissions';

export async function POST(req: Request) {
  try {
    // =========================================================
    // 1. AUTHENTICATION & ADMIN PERMISSION CHECK
    // =========================================================
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: 'Unauthorized: No active session.' }, { status: 401 });
    }

    const user = session.user as any;
    const cleanEmail = String(user.email).trim().toLowerCase();
    const isSuper = isSuperAdminEmail(cleanEmail);

    // Parse incoming multipart form data (JSON backup file upload)
    const formData = await req.formData();
    const file = formData.get('backupFile') as File | null;
    const targetOrgId = formData.get('orgId') as string | null;

    if (!file) {
      return NextResponse.json({ success: false, message: 'Missing backup JSON file.' }, { status: 400 });
    }

    // Read and parse JSON content
    const fileText = await file.text();
    let backupPayload: any;
    try {
      backupPayload = JSON.parse(fileText);
    } catch {
      return NextResponse.json({ success: false, message: 'Invalid JSON format in backup file.' }, { status: 400 });
    }

    if (!backupPayload?.data || !backupPayload?.organization) {
      return NextResponse.json({ success: false, message: 'Invalid backup schema structure.' }, { status: 400 });
    }

    const backupOrgId = backupPayload.organization.id;
    const orgIdToRestore = targetOrgId || backupOrgId;

    // =========================================================
    // 2. TENANT ISOLATION & LIVE DB ROLE RE-VERIFICATION
    // =========================================================
    if (!isSuper) {
      if (user.organizationId && user.organizationId !== orgIdToRestore) {
        return NextResponse.json(
          { success: false, message: 'Forbidden: Cannot restore data for another organization.' },
          { status: 403 }
        );
      }

      const dbUser = await prisma.tenantUser.findFirst({
        where: {
          organizationId: orgIdToRestore,
          email: { equals: cleanEmail, mode: 'insensitive' },
        },
        select: { role: true, status: true },
      });

      const normalizedRole = String(dbUser?.role || '').trim().toLowerCase();
      const isDepartmentAdmin = ['admin', 'administrator', 'master'].includes(normalizedRole);

      if (!dbUser || dbUser.status !== 'Active' || !isDepartmentAdmin) {
        return NextResponse.json(
          { success: false, message: 'Forbidden: Only active Department Administrators can restore database backups.' },
          { status: 403 }
        );
      }
    }

    // Verify organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: orgIdToRestore },
    });

    if (!organization) {
      return NextResponse.json({ success: false, message: 'Target organization not found in database.' }, { status: 404 });
    }

    const records = backupPayload.data;

    // =========================================================
    // 3. TRANSACTIONAL RESTORATION (UPSERT IN DEPENDENCY ORDER)
    // =========================================================
    await prisma.$transaction(async (tx) => {
      // A. Independent / Master Entities
      if (records.students && Array.isArray(records.students)) {
        for (const s of records.students) {
          await tx.student.upsert({
            where: { id: s.id },
            update: { ...s, organizationId: orgIdToRestore },
            create: { ...s, organizationId: orgIdToRestore },
          });
        }
      }

      if (records.funds && Array.isArray(records.funds)) {
        for (const f of records.funds) {
          await tx.fund.upsert({
            where: { id: f.id },
            update: { ...f, organizationId: orgIdToRestore },
            create: { ...f, organizationId: orgIdToRestore },
          });
        }
      }

      if (records.collectionSetups && Array.isArray(records.collectionSetups)) {
        for (const cs of records.collectionSetups) {
          await tx.collectionSetup.upsert({
            where: { id: cs.id },
            update: { ...cs, organizationId: orgIdToRestore },
            create: { ...cs, organizationId: orgIdToRestore },
          });
        }
      }

      if (records.signatories && Array.isArray(records.signatories)) {
        for (const sig of records.signatories) {
          await tx.signatory.upsert({
            where: { id: sig.id },
            update: { ...sig, organizationId: orgIdToRestore },
            create: { ...sig, organizationId: orgIdToRestore },
          });
        }
      }

      // B. Dependent Entities (Collections, Enrollments, Audits, etc.)
      if (records.enrollments && Array.isArray(records.enrollments)) {
        for (const en of records.enrollments) {
          await tx.enrollment.upsert({
            where: { id: en.id },
            update: { ...en, organizationId: orgIdToRestore },
            create: { ...en, organizationId: orgIdToRestore },
          });
        }
      }

      if (records.collections && Array.isArray(records.collections)) {
        for (const col of records.collections) {
          await tx.collection.upsert({
            where: { id: col.id },
            update: { ...col, organizationId: orgIdToRestore },
            create: { ...col, organizationId: orgIdToRestore },
          });
        }
      }

      if (records.collectibles && Array.isArray(records.collectibles)) {
        for (const cob of records.collectibles) {
          await tx.collectible.upsert({
            where: { id: cob.id },
            update: { ...cob, organizationId: orgIdToRestore },
            create: { ...cob, organizationId: orgIdToRestore },
          });
        }
      }

      if (records.penalties && Array.isArray(records.penalties)) {
        for (const pen of records.penalties) {
          await tx.penalty.upsert({
            where: { id: pen.id },
            update: { ...pen, organizationId: orgIdToRestore },
            create: { ...pen, organizationId: orgIdToRestore },
          });
        }
      }

      if (records.cashAdvances && Array.isArray(records.cashAdvances)) {
        for (const ca of records.cashAdvances) {
          await tx.cashAdvance.upsert({
            where: { id: ca.id },
            update: { ...ca, organizationId: orgIdToRestore },
            create: { ...ca, organizationId: orgIdToRestore },
          });
        }
      }

      if (records.audits && Array.isArray(records.audits)) {
        for (const aud of records.audits) {
          await tx.audit.upsert({
            where: { id: aud.id },
            update: { ...aud, organizationId: orgIdToRestore },
            create: { ...aud, organizationId: orgIdToRestore },
          });
        }
      }

      if (records.expenseItems && Array.isArray(records.expenseItems)) {
        for (const ei of records.expenseItems) {
          await tx.expenseItem.upsert({
            where: { id: ei.id },
            update: { ...ei, organizationId: orgIdToRestore },
            create: { ...ei, organizationId: orgIdToRestore },
          });
        }
      }

      if (records.onlineRemittances && Array.isArray(records.onlineRemittances)) {
        for (const orm of records.onlineRemittances) {
          await tx.onlineRemittance.upsert({
            where: { id: orm.id },
            update: { ...orm, organizationId: orgIdToRestore },
            create: { ...orm, organizationId: orgIdToRestore },
          });
        }
      }

      if (records.cashierRemittances && Array.isArray(records.cashierRemittances)) {
        for (const crm of records.cashierRemittances) {
          await tx.cashierRemittance.upsert({
            where: { id: crm.id },
            update: { ...crm, organizationId: orgIdToRestore },
            create: { ...crm, organizationId: orgIdToRestore },
          });
        }
      }

      if (records.voidTransactions && Array.isArray(records.voidTransactions)) {
        for (const vt of records.voidTransactions) {
          await tx.voidTransaction.upsert({
            where: { id: vt.id },
            update: { ...vt, organizationId: orgIdToRestore },
            create: { ...vt, organizationId: orgIdToRestore },
          });
        }
      }

      if (records.fundTransfers && Array.isArray(records.fundTransfers)) {
        for (const ft of records.fundTransfers) {
          await tx.fundTransfer.upsert({
            where: { id: ft.id },
            update: { ...ft, organizationId: orgIdToRestore },
            create: { ...ft, organizationId: orgIdToRestore },
          });
        }
      }

      if (records.realignments && Array.isArray(records.realignments)) {
        for (const realign of records.realignments) {
          await tx.fundRealignment.upsert({
            where: { id: realign.id },
            update: { ...realign, organizationId: orgIdToRestore },
            create: { ...realign, organizationId: orgIdToRestore },
          });
        }
      }
    });

    // Log the restoration event in system logs
    await prisma.systemLog.create({
      data: {
        organizationId: orgIdToRestore,
        user: cleanEmail || 'System Admin',
        action: 'RESTORE_DATABASE_BACKUP',
        details: `Successfully restored database snapshot for ${organization.name}`,
      },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Database backup for ${organization.name} restored successfully.`,
    });

  } catch (error: any) {
    console.error('Backup Restoration Error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Internal server error during database restoration.' },
      { status: 500 }
    );
  }
}