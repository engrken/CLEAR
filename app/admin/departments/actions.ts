// app/admin/departments/actions.ts
'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function createDepartment(formData: FormData) {
  const name = formData.get('name') as string;
  const subdomain = formData.get('subdomain') as string;

  if (!name || !subdomain) {
    throw new Error('Name and subdomain are required.');
  }

  try {
    // Create the organization (omitting 'code' since it is not part of the Organization schema)
    await prisma.organization.create({
      data: {
        name,
        subdomain: subdomain.toLowerCase().trim(),
      },
    });
  } catch (error) {
    console.error("Department creation error:", error);
    throw new Error('Subdomain already exists or database error occurred.');
  }

  revalidatePath('/admin');
  redirect('/admin');
}