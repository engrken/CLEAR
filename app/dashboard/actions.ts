// /app/dashboard/actions.ts
'use server';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { put } from '@vercel/blob'; // <-- Import Vercel Blob

export async function createDepartment(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error('401 Unauthorized');

  const type = formData.get('type') as string;
  const name = formData.get('name') as string;
  const acronym = formData.get('acronym') as string;
  const adminName = formData.get('adminName') as string;
  const adminEmail = formData.get('adminEmail') as string;
  const adminUsername = formData.get('adminUsername') as string;
  const logoFile = formData.get('logo') as File | null;

  if (!type || !name || !acronym || !adminEmail || !adminUsername) {
    throw new Error('All entity and initial administrator fields are required.');
  }

  const cleanSubdomain = acronym.toLowerCase().trim().replace(/\s+/g, '');

  try {
    let logoPath = null;
    if (logoFile && logoFile.size > 0) {
      const extension = logoFile.name.split('.').pop() || 'png';
      const filename = `logos/${cleanSubdomain}_logo_${Date.now()}.${extension}`;
      
      // Upload directly to Vercel Blob
      const blob = await put(filename, logoFile, { 
        access: 'public',
        addRandomSuffix: false // We are already adding a timestamp
      });
      
      // Store the permanent cloud URL instead of a local path
      logoPath = blob.url;
    }

    await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          type,
          name,
          subdomain: cleanSubdomain,
          logo: logoPath, 
        },
      });

      const userId = `USR-${cleanSubdomain.toUpperCase()}-001`;
      const adminTabs = [
        'tab-overview', 'tab-students', 'tab-clearance', 'tab-payment', 
        'tab-remittances', 'tab-penalties', 'tab-advances', 'tab-audit', 
        'tab-collectibles', 'tab-reports', 'tab-void', 'tab-report', 
        'tab-transfer', 'tab-users', 'tab-setup'
      ];

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
    
    return { success: true, message: `${type} '${name}' successfully provisioned!` };
  } catch (error) {
    console.error(error);
    return { success: false, message: 'Acronym, username, or email already exists, or upload failed.' };
  }
}