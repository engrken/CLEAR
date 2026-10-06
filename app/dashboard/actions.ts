'use server';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function createDepartment(formData: FormData) {
  const name = formData.get('name') as string;
  const subdomain = formData.get('subdomain') as string;
  const adminName = formData.get('adminName') as string;
  const adminEmail = formData.get('adminEmail') as string;
  const adminUsername = formData.get('adminUsername') as string;

  if (!name || !subdomain || !adminEmail || !adminUsername) {
    throw new Error('All department and initial administrator fields are required.');
  }

  const cleanSubdomain = subdomain.toLowerCase().trim();

  try {
    // Use a Prisma transaction to ensure both organization and initial admin are created together
    await prisma.$transaction(async (tx) => {
      // 1. Create the Organization
      const org = await tx.organization.create({
        data: {
          name,
          subdomain: cleanSubdomain,
        },
      });

      // 2. Generate initial User ID
      const userId = `USR-${cleanSubdomain.toUpperCase()}-001`;

      // 3. Define full preset tabs for the initial Department Admin
      const adminTabs = [
        'tab-overview', 'tab-students', 'tab-clearance', 'tab-payment', 
        'tab-remittances', 'tab-penalties', 'tab-advances', 'tab-audit', 
        'tab-collectibles', 'tab-reports', 'tab-void', 'tab-report', 
        'tab-transfer', 'tab-users', 'tab-setup'
      ];

      // 4. Create the first Administrator for this department
      await tx.tenantUser.create({
        data: {
          organizationId: org.id,
          userId,
          fullName: adminName,
          username: adminUsername.toLowerCase().trim(),
          email: adminEmail.toLowerCase().trim(),
          role: 'admin',
          status: 'Active',
          allowedTabs: JSON.stringify(adminTabs),
        },
      });
    });

    revalidatePath('/');
	revalidatePath('/dashboard');
	revalidatePath('/dashboard/provisions');
    return { success: true, message: `Department '${name}' and initial administrator successfully provisioned!` };
  } catch (error) {
    console.error(error);
    return { success: false, message: 'Subdomain, username, or email already exists.' };
  }
}