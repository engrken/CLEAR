// /app/api/backup/route.ts

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { requireDepartmentAccess } from '@/lib/permissions';

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    // Accepts ?department=<slug> (preferred) or ?orgId=<id>. Either way the
    // caller's access is re-checked against that organization below.
    const { searchParams } = new URL(req.url);
    const department = searchParams.get('department');
    const orgIdParam = searchParams.get('orgId');

    if (!department && !orgIdParam) {
      return NextResponse.json({ success: false, message: 'Missing department or orgId parameter' }, { status: 400 });
    }

    const target = department
      ? { subdomain: department }
      : await prisma.organization.findUnique({ where: { id: orgIdParam! }, select: { subdomain: true } });

    if (!target) {
      return NextResponse.json({ success: false, message: 'Organization not found' }, { status: 404 });
    }

    // 🚀 SECURITY FIX (F16): A full export needs User Management rights (admins)
    // in THAT organization, or Super Admin. Plain members and viewers are refused.
    let access;
    try {
      access = await requireDepartmentAccess('tab-users', target.subdomain);
    } catch {
      return NextResponse.json({ success: false, message: 'Forbidden: Backup export requires administrator access to this organization' }, { status: 403 });
    }
    const { user, org: organization } = access;
    // Every query below is scoped to the organization the guard resolved.
    const orgId = organization.id;

    // Comprehensive multi-tenant data dump matching your exact schema models
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

    // Log backup action securely
    await prisma.systemLog.create({
      data: {
        organizationId: orgId,
        user: user.fullName || user.email || 'System Admin',
        action: 'EXPORT_DATABASE_BACKUP',
        details: `Exported full database backup for ${organization.name}`,
      }
    }).catch(() => {});

    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `CLEAR_Backup_${organization.subdomain}_${dateStr}.json`;

    return new NextResponse(JSON.stringify(backupPayload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error) {
    console.error('Backup Export Error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error during backup.' }, { status: 500 });
  }
}