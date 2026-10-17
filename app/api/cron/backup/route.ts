// /app/api/cron/backup/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { put } from '@vercel/blob';

export async function GET(req: Request) {
  // 1. Verify Vercel Cron secret to prevent unauthorized public triggers
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false, message: 'Unauthorized cron request.' }, { status: 401 });
  }

  try {
    const organizations = await prisma.organization.findMany();
    const results = [];

    for (const org of organizations) {
      const orgId = org.id;

      // 2. Fetch full tenant data dump
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
          select: { userId: true, fullName: true, username: true, email: true, role: true, status: true },
        }),
      ]);

      const backupPayload = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        organization: org,
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

      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `backups/${org.subdomain}_backup_${dateStr}.json`;

      // 3. Upload JSON snapshot automatically to Vercel Blob Storage
      const blob = await put(filename, JSON.stringify(backupPayload, null, 2), {
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: false,
      });

      // 4. Log the automated backup event in system logs
      await prisma.systemLog.create({
        data: {
          organizationId: orgId,
          user: 'System Cron',
          action: 'AUTOMATED_DAILY_BACKUP',
          details: `Generated and stored daily backup: ${blob.url}`,
        }
      }).catch(() => {});

      results.push({ department: org.subdomain, url: blob.url });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully generated daily backups for ${organizations.length} organizations.`,
      results,
    });

  } catch (error: any) {
    console.error('Automated Cron Backup Error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}