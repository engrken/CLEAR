// /app/api/backup/route.ts

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isSuperAdminEmail } from '@/lib/permissions';
import { encryptClearBackup, MissingBackupKeyError } from '@/lib/backup-security';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as any;
    const cleanEmail = String(user.email).trim().toLowerCase();
    const isSuper = isSuperAdminEmail(cleanEmail);

    const { searchParams } = new URL(req.url);
    let orgId = searchParams.get('orgId');
    const deptParam = searchParams.get('department');

    // Allow lookup by department subdomain (e.g., /api/backup?department=coe)
    if (!orgId && deptParam) {
      const orgBySubdomain = await prisma.organization.findFirst({
        where: { subdomain: { equals: deptParam.trim().toLowerCase(), mode: 'insensitive' } },
        select: { id: true },
      });
      orgId = orgBySubdomain?.id || null;
    }

    // Fallback to the logged-in user's organizationId if neither parameter is passed
    if (!orgId && user.organizationId) {
      orgId = String(user.organizationId);
    }

    if (!orgId) {
      return NextResponse.json(
        { success: false, message: 'Missing orgId or department parameter' },
        { status: 400 }
      );
    }

    // =========================================================
    // 1. TENANT ISOLATION & LIVE DB ROLE RE-VERIFICATION
    // =========================================================
    if (!isSuper) {
      if (user.organizationId && user.organizationId !== orgId) {
        return NextResponse.json(
          { success: false, message: 'Forbidden: Cannot export data for another organization' },
          { status: 403 }
        );
      }

      const dbUser = await prisma.tenantUser.findFirst({
        where: {
          organizationId: orgId,
          email: { equals: cleanEmail, mode: 'insensitive' },
        },
        select: {
          id: true,
          role: true,
          status: true,
        },
      });

      if (!dbUser) {
        return NextResponse.json(
          { success: false, message: 'Forbidden: Account is not registered under this organization' },
          { status: 403 }
        );
      }

      if (dbUser.status !== 'Active') {
        return NextResponse.json(
          { success: false, message: `Forbidden: Your account status is currently ${dbUser.status}` },
          { status: 403 }
        );
      }

      const normalizedRole = String(dbUser.role || '').trim().toLowerCase();
      const isDepartmentAdmin = ['admin', 'administrator', 'master'].includes(normalizedRole);

      if (!isDepartmentAdmin) {
        return NextResponse.json(
          { success: false, message: 'Forbidden: Only active Department Administrators can export system backups' },
          { status: 403 }
        );
      }
    }

    // =========================================================
    // 2. VERIFY ORGANIZATION EXISTS
    // =========================================================
    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!organization) {
      return NextResponse.json({ success: false, message: 'Organization not found' }, { status: 404 });
    }

    // =========================================================
    // 3. MULTI-TENANT DATA DUMP
    // =========================================================
    const [
      students,
      enrollments,
      collections,
      collectionSetups,
      collectibles,
      funds,
      fundTransfers,
      realignments,
      penalties,
      cashAdvances,
      audits,
      expenseItems,
      onlineRemittances,
      cashierRemittances,
      voidTransactions,
      systemLogs,
      signatories,
      tenantUsers
    ] = await Promise.all([
      prisma.student.findMany({ where: { organizationId: orgId } }),
      prisma.enrollment.findMany({ where: { organizationId: orgId } }),
      prisma.collection.findMany({ where: { organizationId: orgId } }),
      prisma.collectionSetup.findMany({ where: { organizationId: orgId } }),
      prisma.collectible.findMany({ where: { organizationId: orgId } }),
      prisma.fund.findMany({ where: { organizationId: orgId } }),
      prisma.fundTransfer.findMany({ where: { organizationId: orgId } }),
      prisma.fundRealignment.findMany({ where: { organizationId: orgId } }),
      prisma.penalty.findMany({ where: { organizationId: orgId } }),
      prisma.cashAdvance.findMany({ where: { organizationId: orgId } }),
      prisma.audit.findMany({ where: { organizationId: orgId } }),
      prisma.expenseItem.findMany({ where: { organizationId: orgId } }),
      prisma.onlineRemittance.findMany({ where: { organizationId: orgId } }),
      prisma.cashierRemittance.findMany({ where: { organizationId: orgId } }),
      prisma.voidTransaction.findMany({ where: { organizationId: orgId } }),
      prisma.systemLog.findMany({ where: { organizationId: orgId } }),
      prisma.signatory.findMany({ where: { organizationId: orgId } }),
      prisma.tenantUser.findMany({
        where: { organizationId: orgId },
        select: {
          userId: true,
          fullName: true,
          username: true,
          email: true,
          role: true,
          status: true,
        },
      }),
    ]);

    const backupPayload = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      organization,
      metrics: {
        studentsCount: students.length,
        collectionsCount: collections.length,
        auditsCount: audits.length,
      },
      data: {
        students,
        enrollments,
        collections,
        collectionSetups,
        collectibles,
        funds,
        fundTransfers,
        realignments,
        penalties,
        cashAdvances,
        audits,
        expenseItems,
        onlineRemittances,
        cashierRemittances,
        voidTransactions,
        systemLogs,
        signatories,
        tenantUsers,
      },
    };

    // Never offer a plaintext financial snapshot as a downloadable backup.
    // AES-256-GCM provides confidentiality AND authenticated integrity.
    const encrypted = encryptClearBackup(backupPayload, orgId);
    await prisma.systemLog.create({
      data: {
        organizationId: orgId,
        user: cleanEmail || 'System Admin',
        action: 'EXPORT_DATABASE_BACKUP',
        details: `Exported full database backup for ${organization.name}`,
      }
    }).catch(() => {});

    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `CLEAR_Backup_${organization.subdomain}_${dateStr}.encrypted.json`;

    return new NextResponse(JSON.stringify(encrypted), {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error: any) {
    console.error('Backup Export Error:', error instanceof MissingBackupKeyError ? 'Missing backup encryption key' : error);
    return NextResponse.json(
      { success: false, message: error instanceof MissingBackupKeyError ? 'Backup encryption key is not configured.' : 'Backup export failed.' },
      { status: error instanceof MissingBackupKeyError ? 503 : 500 }
    );
  }
}