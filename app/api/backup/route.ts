// app/api/backup/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function GET(request: Request) {
  const session = await auth();
  
  // 1. Tell TypeScript that this user object has an optional 'role' property
  const userWithRole = session?.user as typeof session.user & { role?: string };

  // 2. Security: Only allow admins to trigger database dumps
  if (userWithRole?.role !== 'admin') {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('orgId');

  if (!organizationId) {
    return new NextResponse('Organization ID required', { status: 400 });
  }

  // Fetch all relevant data for the backup
  const [collections, audits, advances] = await Promise.all([
    prisma.collection.findMany({ where: { organizationId } }),
    prisma.audit.findMany({ where: { organizationId } }),
    prisma.cashAdvance.findMany({ where: { organizationId } })
  ]);

  // Format as JSON (or use a library like 'xlsx' to convert to Excel buffer)
  const backupData = {
    timestamp: new Date().toISOString(),
    collections,
    audits,
    advances
  };

  return new NextResponse(JSON.stringify(backupData, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="CLEAR_Backup_${new Date().toISOString().split('T')[0]}.json"`,
    },
  });
}