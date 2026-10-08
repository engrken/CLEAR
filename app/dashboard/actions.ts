// /app/dashboard/actions.ts
'use server';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function createDepartment(formData: FormData) {
  // Optional: Enforce session validation
  const session = await auth();
  if (!session?.user) {
    throw new Error('401 Unauthorized: Session expired or invalid.');
  }

  // Extract the new type and acronym fields, plus your existing admin fields
  const type = formData.get('type') as string;
  const name = formData.get('name') as string;
  const acronym = formData.get('acronym') as string;
  const adminName = formData.get('adminName') as string;
  const adminEmail = formData.get('adminEmail') as string;
  const adminUsername = formData.get('adminUsername') as string;

  if (!type || !name || !acronym || !adminEmail || !adminUsername) {
    throw new Error('All entity and initial administrator fields are required.');
  }

  // Clean the acronym to act as a secure URL subdomain (no spaces)
  const cleanSubdomain = acronym.toLowerCase().trim().replace(/\s+/g, '');

  try {
    // Use a Prisma transaction to ensure both organization and initial admin are created together
    await prisma.$transaction(async (tx) => {
      // 1. Create the Organization (Now with Type)
      const org = await tx.organization.create({
        data: {
          type, // "Department" or "Organization"
          name,
          subdomain: cleanSubdomain,
        },
      });

      // 2. Generate initial User ID (Preserving your exact logic)
      const userId = `USR-${cleanSubdomain.toUpperCase()}-001`;

      // 3. Define full preset tabs for the initial Department Admin (Preserving your exact array)
      const adminTabs = [
        'tab-overview', 'tab-students', 'tab-clearance', 'tab-payment', 
        'tab-remittances', 'tab-penalties', 'tab-advances', 'tab-audit', 
        'tab-collectibles', 'tab-reports', 'tab-void', 'tab-report', 
        'tab-transfer', 'tab-users', 'tab-setup'
      ];

      // 4. Create the first Administrator for this department/organization
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
    
    // Dynamic success message based on whether it's a Department or Organization
    return { success: true, message: `${type} '${name}' and initial administrator successfully provisioned!` };
  } catch (error) {
    console.error(error);
    return { success: false, message: 'Acronym, username, or email already exists.' };
  }
}