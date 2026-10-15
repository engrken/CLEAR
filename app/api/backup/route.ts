// /app/api/backup/route.ts

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isSuperAdminEmail } from '@/lib/permissions';
import { logSystemAction } from '@/lib/logger';

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as any;
    const isSuper = isSuperAdminEmail(user.email) || user.role === 'SuperAdmin';
    const userOrgId = user.organizationId;

    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get('orgId');

    if (!orgId) {
      return NextResponse.json({ success: false, message: 'Missing orgId parameter' }, { status: 400 });
    }

    // 🚀 SECURITY FIX (F16): Prevent Cross-Tenant IDOR.
    // Non-SuperAdmin users can only export their own organization's data.
    if (!isSuper && userOrgId !== orgId) {
      return NextResponse.json({ success: false, message: 'Forbidden: Cannot export data for another organization' }, { status: 403 });
    }

    // Verify organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!organization) {
      return NextResponse.json({ success: false, message: 'Organization not found' }, { status: 404 });
    }

    // Comprehensive multi-tenant data dump
    const [
      students,
      enrollments,
      collections,
      collectionSetups,
      collectibles,
      funds,
      fundTransfers,
      penalties,
      cashAdvances,
      audits,
      expenseItems,
      onlineRemittances,
      cashierRemittances,
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
      prisma.penalty.findMany({ where: { organizationId: orgId } }),
      prisma.cashAdvance.findMany({ where: { organizationId: orgId } }),
      prisma.audit.findMany({ where: { organizationId: orgId } }),
      prisma.expenseItem.findMany({ where: { audit: { organizationId: orgId } } }),
      prisma.onlineRemittance.findMany({ where: { organizationId: orgId } }),
      prisma.cashierRemittance.findMany({ where: { organizationId: orgId } }),
      prisma.systemLog.findMany({ where: { organizationId: orgId } }),
      prisma.signatories?.findMany ? prisma.signatories.findMany({ where: { organizationId: orgId } }) : Promise.resolve([]),
      prisma.tenantUser.findMany({ where: { organizationId: orgId }, select: { userId: true, fullName: true, username: true, email: true, role: true, status: true } }),
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
        penalties,
        cashAdvances,
        audits,
        expenseItems,
        onlineRemittances,
        cashierRemittances,
        systemLogs,
        signatories,
        tenantUsers,
      },
    };

    // Log backup action
    await logSystemAction(orgId, user.email || 'System Admin', 'EXPORT_DATABASE_BACKUP', `Exported full database backup for ${organization.name}`);

    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `CLEAR_Backup_${organization.subdomain}_${dateStr}.json`;

    return new NextResponse(JSON.stringify(backupPayload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error: any) {
    console.error('Backup Export Error:', error);
    return NextResponse.json({ success: false, message: error.message || 'Internal server error during backup.' }, { status: 500 });
  }
}