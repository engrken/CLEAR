// /app/api/cron/backup/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { put } from '@vercel/blob';
import crypto from 'node:crypto';

function authorizedCron(req: Request) {
  const secret = process.env.CRON_SECRET;
  // Without a configured secret the job is off: "Bearer undefined" must not pass.
  if (!secret || secret.length < 16) return false;
  const given = Buffer.from(req.headers.get('authorization') || '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

export async function GET(req: Request) {
  // 1. Only Vercel Cron (which sends CRON_SECRET) may trigger a backup run.
  if (!authorizedCron(req)) {
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

      // 3. Upload the snapshot as a PRIVATE blob with an unguessable name. Backups
      // hold students' and officers' personal data; they must never be public, and
      // their location is not written anywhere officers can read.
      const blob = await put(filename, JSON.stringify(backupPayload, null, 2), {
        access: 'private',
        contentType: 'application/json',
        addRandomSuffix: true,
      });

      // 4. Log the automated backup event in system logs (no URL)
      await prisma.systemLog.create({
        data: {
          organizationId: orgId,
          user: 'System Cron',
          action: 'AUTOMATED_DAILY_BACKUP',
          details: `Generated the daily backup (${students.length} students, ${collections.length} collections).`,
        }
      }).catch(() => {});

      results.push({ department: org.subdomain, pathname: blob.pathname });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully generated daily backups for ${organizations.length} organizations.`,
      results,
    });

  } catch (error) {
    console.error('Automated Cron Backup Error:', error);
    return NextResponse.json({ success: false, message: 'Backup run failed.' }, { status: 500 });
  }
}