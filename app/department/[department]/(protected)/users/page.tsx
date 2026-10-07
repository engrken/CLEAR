import { prisma } from '@/lib/prisma';
import UserManagementClient from './UserManagementClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Centralized Liquidation of Expenses & Audit Records',
};

const ROLE_PERMISSIONS_MAP: Record<string, string[]> = {
  admin: [
    'tab-overview', 'tab-students', 'tab-clearance', 'tab-reports',
    'tab-payment', 'tab-remittances', 'tab-penalties', 'tab-advances',
    'tab-audit', 'tab-collectibles', 'tab-void', 'tab-report', 'tab-transfer',
    'tab-users', 'tab-setup'
  ],
  treasurer: [
    'tab-overview', 'tab-clearance', 'tab-reports',
    'tab-payment', 'tab-remittances', 'tab-penalties', 'tab-advances',
    'tab-collectibles', 'tab-report', 'tab-transfer'
  ],
  auditor: [
    'tab-overview', 'tab-clearance', 'tab-reports', 'tab-audit', 'tab-report'
  ],
  viewer: [
    'tab-overview', 'tab-clearance', 'tab-reports', 'tab-report'
  ]
};

interface PageProps {
  params: Promise<{ department: string }>;
}

export default async function UserManagementPage({ params }: PageProps) {
  const resolvedParams = await params;
  const department = resolvedParams?.department || 'engineering';
  const cleanSubdomain = department.toLowerCase();

  let users: any[] = []; 
  try {
    // 1. Ensure Organization exists (Auto-tenant provisioning)
    let organization = await prisma.organization.findUnique({
      where: { subdomain: cleanSubdomain },
    });

    if (!organization) {
      organization = await prisma.organization.create({
        data: {
          subdomain: cleanSubdomain,
          name: `College of ${department.charAt(0).toUpperCase() + department.slice(1)}`,
        },
      });
    }

    // 2. Ensure Master Admin is ALWAYS seeded for this tenant
    const masterEmail = 'kent.bsece@gmail.com';
    const existingMaster = await prisma.tenantUser.findFirst({
      where: { 
        organizationId: organization.id,
        email: masterEmail 
      }
    });

    // If master doesn't exist, create it. If it does, do NOT overwrite its custom allowedTabs.
    if (!existingMaster) {
      await prisma.tenantUser.create({
        data: {
          organizationId: organization.id,
          userId: `USR-${cleanSubdomain.toUpperCase()}-MASTER`,
          fullName: 'Engr. Kenneth Mark D.C. Bulquerin',
          username: `master_${cleanSubdomain}`,
          email: masterEmail,
          role: 'admin',
          allowedTabs: JSON.stringify(ROLE_PERMISSIONS_MAP.admin),
          status: 'Active',
        },
      }).catch(() => {});
    }

    // 3. Seed other default officers if needed
    let dbUsers = await prisma.tenantUser.findMany({
      where: { organizationId: organization.id },
      orderBy: { fullName: 'asc' },
    });

    if (dbUsers.length <= 1) {
      const prefix = cleanSubdomain.toUpperCase();
      const defaultAccounts = [
        { userId: `USR-${prefix}-02`, fullName: 'System Administrator', username: `${cleanSubdomain}_admin`, email: `${cleanSubdomain}.admin@filamer.edu.ph`, role: 'admin', allowedTabs: JSON.stringify(ROLE_PERMISSIONS_MAP.admin), status: 'Active' },
        { userId: `USR-${prefix}-03`, fullName: 'Department Treasurer', username: `${cleanSubdomain}_treasurer`, email: `${cleanSubdomain}.treasurer@filamer.edu.ph`, role: 'treasurer', allowedTabs: JSON.stringify(ROLE_PERMISSIONS_MAP.treasurer), status: 'Active' },
        { userId: `USR-${prefix}-04`, fullName: 'Department Auditor', username: `${cleanSubdomain}_auditor`, email: `${cleanSubdomain}.auditor@filamer.edu.ph`, role: 'auditor', allowedTabs: JSON.stringify(ROLE_PERMISSIONS_MAP.auditor), status: 'Active' },
      ];

      for (const acc of defaultAccounts) {
        await prisma.tenantUser.create({
          data: {
            organizationId: organization.id,
            userId: acc.userId,
            fullName: acc.fullName,
            username: acc.username,
            email: acc.email,
            role: acc.role,
            allowedTabs: acc.allowedTabs,
            status: acc.status,
          },
        }).catch(() => {});
      }

      dbUsers = await prisma.tenantUser.findMany({
        where: { organizationId: organization.id },
        orderBy: { fullName: 'asc' },
      });
    }

    users = dbUsers.map(u => ({
      id: u.id,
      userId: u.userId,
      name: u.fullName,
      email: u.email,
      username: u.username,
      role: u.role,
      status: u.status,
      allowedTabs: u.allowedTabs ? JSON.parse(u.allowedTabs) : []
    }));
  } catch (err) {
    console.warn("Database synchronization warning:", err);
  }

  return <UserManagementClient initialUsers={users} department={department} />;
}