import { formatManilaDateTime24 } from '@/lib/clear-timezone';
// /app/api/cron/backup/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { put } from '@vercel/blob';
import crypto from 'node:crypto';

export async function GET(req: Request) {
  // 1. Verify Vercel Cron secret to prevent unauthorized public triggers
  const authHeader = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false, message: 'Unauthorized cron request.' }, { status: 401 });
  }

  try {
    // Encrypt before uploading: Vercel Blob with public access is NOT a private backup vault.
    // Provide a stable 32-byte key in BACKUP_ENCRYPTION_KEY (64 hex digits or base64).
    const rawKey = process.env.BACKUP_ENCRYPTION_KEY || '';
    const key = /^[a-f\d]{64}$/i.test(rawKey)
      ? Buffer.from(rawKey, 'hex')
      : Buffer.from(rawKey, 'base64');
    if (key.length !== 32) {
      return NextResponse.json({ success: false, message: 'BACKUP_ENCRYPTION_KEY must be configured (32 bytes).' }, { status: 503 });
    }
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

      const exportedAtInstant = new Date();
      const backupPayload = {
        version: '1.0',
        exportedAt: exportedAtInstant.toISOString(),
        exportedAtManila: formatManilaDateTime24(exportedAtInstant),
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

      const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `backups/${org.subdomain}_backup_${dateStr}.encrypted.json`;
      const plaintext = Buffer.from(JSON.stringify(backupPayload), 'utf8');
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      cipher.setAAD(Buffer.from(orgId, 'utf8'));
      const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
      const envelope = {
        format: 'CLEAR_ENCRYPTED_BACKUP_V1',
        organizationId: orgId,
        algorithm: 'aes-256-gcm',
        iv: iv.toString('base64'),
        authTag: cipher.getAuthTag().toString('base64'),
        ciphertext: ciphertext.toString('base64'),
      };

      const blob = await put(filename, JSON.stringify(envelope), {
        access: 'public', // Public URL contains only authenticated ciphertext.
        contentType: 'application/json',
        addRandomSuffix: true,
      });

      await prisma.systemLog.create({
        data: {
          organizationId: orgId,
          user: 'System Cron',
          action: 'AUTOMATED_DAILY_BACKUP',
          details: `Encrypted snapshot saved: ${filename}. Blob pathname: ${new URL(blob.url).pathname}`,
        },
      });
      // Do not publish backup URLs in the cron response or plain-text system logs.
      results.push({ department: org.subdomain, encrypted: true });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully generated daily backups for ${organizations.length} organizations.`,
      results,
    });

  } catch (error: any) {
    console.error('Automated Cron Backup Error:', error);
    return NextResponse.json({ success: false, message: 'Encrypted backup failed; review server logs.' }, { status: 500 });
  }
}