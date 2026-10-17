// /app/dashboard/provisions/actions.ts
'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { isSuperAdminEmail } from '@/lib/permissions';
import { revalidatePath } from 'next/cache';

async function verifyMasterSuperAdmin() {
  const session = await auth();
  const email = String(session?.user?.email || '').trim().toLowerCase();
  if (!email || !isSuperAdminEmail(email)) {
    throw new Error('Unauthorized: Master SuperAdmin privileges required.');
  }
  return email;
}

export async function provisionEntityWithTier(data: {
  name: string;
  subdomain: string;
  schoolGroup: string;
  tier: 'Freemium' | 'Pro' | 'Corporate';
  type: string;
  adminEmail?: string;
  adminName?: string;
}) {
  await verifyMasterSuperAdmin();

  const name = String(data.name || '').trim();
  const subdomain = String(data.subdomain || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '');
  const schoolGroup = String(data.schoolGroup || 'default-school')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '');
  const tier = data.tier || 'Freemium';
  const type = data.type || 'Department';
  const adminEmail = String(data.adminEmail || '').trim().toLowerCase();
  const adminName = String(data.adminName || 'Entity Administrator').trim();

  if (!name || !subdomain || !schoolGroup) {
    throw new Error('School Group, Entity Name, and Subdomain are required.');
  }

  if (!/^[a-z0-9-]+$/.test(subdomain)) {
    throw new Error('Subdomain slug can only contain lowercase letters, numbers, and hyphens.');
  }

  // Check if subdomain already exists
  const existingSubdomain = await prisma.organization.findUnique({
    where: { subdomain },
  });

  if (existingSubdomain) {
    throw new Error(`Subdomain '${subdomain}' is already in use by another entity.`);
  }

  // Enforce tier limits per schoolGroup (excluding default-school if ungrouped)
  if (schoolGroup !== 'default-school') {
    const existingGroupOrgs = await prisma.organization.findMany({
      where: { schoolGroup },
    });

    const maxAllowed = tier === 'Freemium' ? 2 : tier === 'Pro' ? 10 : 999;
    if (existingGroupOrgs.length >= maxAllowed) {
      throw new Error(
        `School group '${schoolGroup}' has reached the maximum limit of ${maxAllowed} entities for the ${tier} tier.`
      );
    }
  }

  const defaultTabs = [
    'tab-overview', 'tab-students', 'tab-clearance', 'tab-payment',
    'tab-remittances', 'tab-penalties', 'tab-advances', 'tab-audit',
    'tab-collectibles', 'tab-reports', 'tab-void', 'tab-report',
    'tab-transfer', 'tab-users', 'tab-setup',
  ];

  await prisma.$transaction(async (tx) => {
    // 1. Create the Organization
    const org = await tx.organization.create({
      data: {
        name,
        subdomain,
        schoolGroup,
        tier,
        type,
        status: 'Active',
      },
    });

    // 2. Sync tier across all organizations in the same schoolGroup (if not default-school)
    if (schoolGroup !== 'default-school') {
      await tx.organization.updateMany({
        where: { schoolGroup },
        data: { tier },
      });
    }

    // 3. Provision Initial Entity Admin User so they can log into /dashboard/entity/login
    if (adminEmail) {
      const baseUsername = adminEmail.split('@')[0].replace(/[^a-z0-9]/g, '');
      await tx.tenantUser.create({
        data: {
          organizationId: org.id,
          userId: `USR-${subdomain.toUpperCase()}-001`,
          fullName: adminName,
          username: `${baseUsername}_${subdomain}`.slice(0, 30),
          email: adminEmail,
          role: 'admin',
          allowedTabs: JSON.stringify(defaultTabs),
          status: 'Active',
        },
      });
    }
  });

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/provisions');
  revalidatePath('/dashboard/entity/portal');
}

export async function updateOrganizationTier(
  orgId: string,
  newTier: 'Freemium' | 'Pro' | 'Corporate'
) {
  await verifyMasterSuperAdmin();

  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) throw new Error('Organization not found.');

  // If part of a named schoolGroup, sync the tier across the whole schoolGroup
  if (org.schoolGroup && org.schoolGroup !== 'default-school') {
    await prisma.organization.updateMany({
      where: { schoolGroup: org.schoolGroup },
      data: { tier: newTier },
    });
  } else {
    await prisma.organization.update({
      where: { id: orgId },
      data: { tier: newTier },
    });
  }

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/provisions');
  revalidatePath('/dashboard/entity/portal');
}

export async function updateOrganizationStatus(
  orgId: string,
  newStatus: 'Active' | 'Inactive' | 'Archived'
) {
  await verifyMasterSuperAdmin();

  await prisma.organization.update({
    where: { id: orgId },
    data: { status: newStatus },
  });

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/provisions');
  revalidatePath('/dashboard/entity/portal');
}

export async function updateOrganizationSchoolGroup(orgId: string, newGroup: string) {
  await verifyMasterSuperAdmin();

  const cleanGroup = String(newGroup || 'default-school')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '');

  await prisma.organization.update({
    where: { id: orgId },
    data: { schoolGroup: cleanGroup || 'default-school' },
  });

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/provisions');
  revalidatePath('/dashboard/entity/portal');
}

export async function deleteOrganization(orgId: string) {
  await verifyMasterSuperAdmin();

  await prisma.organization.delete({
    where: { id: orgId },
  });

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/provisions');
  revalidatePath('/dashboard/entity/portal');
}