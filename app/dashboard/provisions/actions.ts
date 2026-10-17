// /app/dashboard/provisions/actions.ts
"use server";

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { isSuperAdminEmail } from '@/lib/permissions';
import { revalidatePath } from 'next/cache';

async function verifySuperAdmin() {
  const session = await auth();
  const email = String(session?.user?.email || '').trim().toLowerCase();
  if (!email || !isSuperAdminEmail(email)) {
    throw new Error("Unauthorized: SuperAdmin privileges required.");
  }
}

export async function updateOrganizationStatus(organizationId: string, newStatus: 'Active' | 'Inactive' | 'Archived') {
  await verifySuperAdmin();

  await prisma.organization.update({
    where: { id: organizationId },
    data: { status: newStatus },
  });

  revalidatePath('/dashboard/provisions');
  return { success: true, message: `Tenant successfully marked as ${newStatus}.` };
}

export async function deleteOrganization(organizationId: string) {
  await verifySuperAdmin();

  // Perform transactional deletion of tenant data and the organization
  await prisma.$transaction(async (tx) => {
    // Delete all dependent scoped records first to respect foreign key constraints
    await tx.collection.deleteMany({ where: { organizationId } });
    await tx.enrollment.deleteMany({ where: { organizationId } });
    await tx.student.deleteMany({ where: { organizationId } });
    await tx.fund.deleteMany({ where: { organizationId } });
    await tx.tenantUser.deleteMany({ where: { organizationId } });
    await tx.systemLog.deleteMany({ where: { organizationId } });
    // Finally delete the organization container
    await tx.organization.delete({ where: { id: organizationId } });
  });

  revalidatePath('/dashboard/provisions');
  return { success: true, message: "Tenant organization permanently deleted." };
}