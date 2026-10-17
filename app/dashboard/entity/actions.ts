// app/dashboard/entity/actions.ts
'use server';

import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getAuthenticatedEntityAdmin, ENTITY_SESSION_COOKIE } from '@/lib/entity-session';
import { DEMO_ORG_SLUG } from '@/lib/demo-reviewer';
import { logSystemAction } from '@/lib/logger';

const ADMIN_ROLES = ['admin', 'administrator', 'superadmin'];

export async function provisionSubEntityAction(formData: FormData) {
  const email = await getAuthenticatedEntityAdmin();
  if (!email) {
    throw new Error('Unauthorized: Your Entity Admin session has expired. Please log in again.');
  }

  const primaryAdminRecord = await prisma.tenantUser.findFirst({
    where: {
      email: { equals: email, mode: 'insensitive' },
      role: { in: ADMIN_ROLES, mode: 'insensitive' },
      status: 'Active',
      organization: { status: 'Active' },
    },
    include: { organization: true },
  });

  if (!primaryAdminRecord) {
    throw new Error('Unauthorized: Admin record not found.');
  }

  const name = String(formData.get('name') || '').trim();
  const subdomain = String(formData.get('subdomain') || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '');
  const type = String(formData.get('type') || 'Department').trim();
  const customGroup = String(formData.get('schoolGroup') || '').trim().toLowerCase();

  if (!name || !subdomain) {
    throw new Error('Entity Name and Subdomain Slug are required.');
  }

  if (!/^[a-z0-9-]+$/.test(subdomain)) {
    throw new Error('Subdomain slug may only contain lowercase letters, numbers, and hyphens.');
  }

  if (subdomain === DEMO_ORG_SLUG) {
    throw new Error(`The subdomain '${DEMO_ORG_SLUG}' is reserved.`);
  }

  const existingSlug = await prisma.organization.findUnique({
    where: { subdomain },
  });

  if (existingSlug) {
    throw new Error(`The subdomain '/department/${subdomain}' is already taken.`);
  }

  let targetSchoolGroup = primaryAdminRecord.organization.schoolGroup;
  if (targetSchoolGroup === 'default-school' && customGroup && customGroup !== 'default-school') {
    // Naming a group creates it. Joining a group that already exists would expose
    // that school's entities, so that needs the Super Admin (Provisions page).
    const groupTaken = await prisma.organization.count({ where: { schoolGroup: customGroup } });
    if (groupTaken > 0) {
      throw new Error(`The school group '${customGroup}' already exists. Ask the Super Admin to add your entity to it.`);
    }
    targetSchoolGroup = customGroup;
    await prisma.organization.update({
      where: { id: primaryAdminRecord.organizationId },
      data: { schoolGroup: targetSchoolGroup },
    });
  }

  const currentTier = primaryAdminRecord.organization.tier || 'Freemium';
  const maxAllowed = currentTier === 'Freemium' ? 2 : currentTier === 'Pro' ? 10 : 999;

  const existingGroupCount =
    targetSchoolGroup === 'default-school'
      ? 1
      : await prisma.organization.count({
          where: { schoolGroup: targetSchoolGroup },
        });

  if (existingGroupCount >= maxAllowed) {
    throw new Error(
      `Tier limit reached: Your ${currentTier} plan allows up to ${maxAllowed} entities for group '${targetSchoolGroup}'.`
    );
  }

  const defaultTabs = [
    'tab-overview', 'tab-students', 'tab-clearance', 'tab-payment',
    'tab-remittances', 'tab-penalties', 'tab-advances', 'tab-audit',
    'tab-collectibles', 'tab-reports', 'tab-void', 'tab-report',
    'tab-transfer', 'tab-users', 'tab-setup',
  ];

  await prisma.$transaction(async (tx) => {
    const newOrg = await tx.organization.create({
      data: {
        name,
        subdomain,
        schoolGroup: targetSchoolGroup,
        tier: currentTier,
        type,
        status: 'Active',
      },
    });

    await tx.tenantUser.create({
      data: {
        organizationId: newOrg.id,
        userId: `USR-${subdomain.toUpperCase()}-001`,
        fullName: primaryAdminRecord.fullName,
        username: `${primaryAdminRecord.username}_${subdomain}`.slice(0, 30),
        email: primaryAdminRecord.email,
        role: 'admin',
        allowedTabs: JSON.stringify(defaultTabs),
        status: 'Active',
      },
    });
  });

  await logSystemAction(
    primaryAdminRecord.organizationId,
    primaryAdminRecord.fullName || email,
    'PROVISION_SUB_ENTITY',
    `Provisioned entity '${name}' (/department/${subdomain}) in school group '${targetSchoolGroup}'.`
  );

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/provisions');
  revalidatePath('/dashboard/entity/portal');
}

export async function logoutEntityAdminAction() {
  const cookieStore = await cookies();
  cookieStore.delete(ENTITY_SESSION_COOKIE);
  redirect('/dashboard/entity/login');
}