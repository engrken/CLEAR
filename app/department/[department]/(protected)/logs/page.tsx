import { prisma } from '@/lib/prisma';
import LogsClient from './LogsClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Centralized Liquidation of Expenses & Audit Records',
};

interface PageProps {
  params: Promise<{ department: string }>;
  searchParams: Promise<{ page?: string }>;
}

export default async function SystemLogsPage({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const resolvedSearch = await searchParams;
  const department = resolvedParams?.department || 'engineering';
  const page = parseInt(resolvedSearch?.page || '1', 10);
  const pageSize = 10;
  const skip = (page - 1) * pageSize;

  const organization = await prisma.organization.findUnique({
    where: { subdomain: department.toLowerCase() },
  });

  let logs: any[] = [];
  let totalCount = 0;

  if (organization) {
    const where = { organizationId: organization.id };
    totalCount = await prisma.systemLog.count({ where });
    logs = await prisma.systemLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      skip,
      take: pageSize,
    });
  }

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  const serializedLogs = logs.map(l => ({
    id: l.id,
    timestamp: new Date(l.timestamp).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'medium'
    }),
    user: l.user,
    action: l.action,
    details: l.details,
  }));

  // Use organization.name if found, otherwise fallback to department string
  const displayName = organization ? organization.name : department;

  return (
    <LogsClient 
      initialLogs={serializedLogs} 
      department={displayName} 
      currentPage={page} 
      totalPages={totalPages} 
    />
  );
}