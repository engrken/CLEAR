'use server';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function createDepartment(formData: FormData) {
  // --------------------------------------------------
  // SUPER ADMIN SECURITY CHECK
  // --------------------------------------------------

  const session = await auth();

  if (!session || session.user?.email !== 'kent.bsece@gmail.com') {
    return {
      success: false,
      message: 'Unauthorized. Super Administrator access required.',
    };
  }

  // --------------------------------------------------
  // GET FORM DATA
  // --------------------------------------------------

  const name = String(formData.get('name') || '').trim();
  const subdomain = String(formData.get('subdomain') || '')
    .toLowerCase()
    .trim();

  if (!name || !subdomain) {
    return {
      success: false,
      message: 'All fields are required.',
    };
  }

  // --------------------------------------------------
  // BASIC SUBDOMAIN VALIDATION
  // --------------------------------------------------

  const subdomainPattern = /^[a-z0-9-]+$/;

  if (!subdomainPattern.test(subdomain)) {
    return {
      success: false,
      message:
        'Invalid subdomain. Use only lowercase letters, numbers, and hyphens.',
    };
  }

  // --------------------------------------------------
  // CREATE DEPARTMENT
  // --------------------------------------------------

  try {
    await prisma.organization.create({
      data: {
        name,
        subdomain,
      },
    });

    // Refresh Dashboard and Provision pages
    revalidatePath('/dashboard');
    revalidatePath('/dashboard/provisions');

    return {
      success: true,
      message: `Department '${name}' successfully registered!`,
    };
  } catch (error) {
    console.error('CREATE DEPARTMENT ERROR:', error);

    return {
      success: false,
      message: 'Subdomain already exists or database error.',
    };
  }
}