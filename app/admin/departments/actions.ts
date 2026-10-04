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

  // Create the organization in Neon Postgres
  await prisma.organization.create({
    data: {
      name,
      subdomain: subdomain.toLowerCase().trim(),
    },
  });

  revalidatePath('/admin');
  redirect('/admin');
}