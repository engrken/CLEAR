// app/dashboard/actions.ts
'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { requireSuperAdmin } from '@/lib/permissions';

export async function createDepartment(formData: FormData) {
  await requireSuperAdmin();

  const type = String(formData.get('type') || 'Department').trim();
  const name = String(formData.get('name') || '').trim();
  const subdomain = String(formData.get('acronym') || formData.get('subdomain') || '')
    .trim()
    .toLowerCase();
  const schoolGroup = String(formData.get('schoolGroup') || 'default-school')
    .trim()
    .toLowerCase();

  const adminName = String(formData.get('adminName') || '').trim();
  const adminEmail = String(formData.get('adminEmail') || '').trim().toLowerCase();
  const adminUsername = String(formData.get('adminUsername') || '').trim().toLowerCase();

  if (!name || !subdomain || !adminEmail || !adminUsername || !adminName) {
    throw new Error('All entity details and initial administrator fields are required.');
  }

  if (!/^[a-z0-9-]+$/.test(subdomain)) {
    throw new Error('Acronym / Subdomain may contain only lowercase letters, numbers, and hyphens.');
  }

  const existingOrg = await prisma.organization.findUnique({
    where: { subdomain },
  });

  if (existingOrg) {
    throw new Error(`An organization with acronym '${subdomain}' already exists.`);
  }

  try {
    await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name,
          subdomain,
          schoolGroup,
          type: type === 'Organization' ? 'Organization' : 'Department',
          tier: 'Freemium',
          status: 'Active',
        },
      });

      const defaultTabs = [
        'tab-overview', 'tab-students', 'tab-clearance', 'tab-payment',
        'tab-remittances', 'tab-penalties', 'tab-advances', 'tab-audit',
        'tab-collectibles', 'tab-reports', 'tab-void', 'tab-report',
        'tab-transfer', 'tab-users', 'tab-setup',
      ];

      await tx.tenantUser.create({
        data: {
          organizationId: org.id,
          userId: `USR-${subdomain.toUpperCase()}-001`,
          fullName: adminName,
          username: adminUsername,
          email: adminEmail,
          role: 'admin',
          allowedTabs: JSON.stringify(defaultTabs),
          status: 'Active',
        },
      });
    });

    revalidatePath('/');
    revalidatePath('/dashboard');
    revalidatePath('/dashboard/provisions');
    revalidatePath('/dashboard/entity/portal');

    return { success: true, message: `Entity '${name}' successfully provisioned!` };
  } catch (error: any) {
    console.error('Provisioning error:', error);
    return { success: false, message: error.message || 'Failed to provision department.' };
  }
}