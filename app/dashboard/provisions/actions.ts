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

// 🚀 1. PROVISION ENTITY WITH SCHOOL-LEVEL FREEMIUM LIMIT GUARD
export async function provisionEntityWithTier(data: { 
  name: string; 
  subdomain: string; 
  type: string; 
  tier?: string;
  schoolGroup: string; 
}) {
  await verifySuperAdmin();

  const cleanSubdomain = data.subdomain.toLowerCase().trim();
  const cleanSchoolGroup = data.schoolGroup.toLowerCase().trim();
  const tier = data.tier || 'Freemium';

  // Check if subdomain already exists globally across the platform
  const existingOrg = await prisma.organization.findUnique({
    where: { subdomain: cleanSubdomain },
  });

  if (existingOrg) {
    throw new Error(`The subdomain "${cleanSubdomain}" is already taken. Please use a unique identifier.`);
  }

  // Enforce Freemium constraint: Max 2 tenants PER SCHOOL GROUP
  if (tier === 'Freemium') {
    const existingFreemiumCount = await prisma.organization.count({
      where: { 
        schoolGroup: cleanSchoolGroup,
        tier: 'Freemium' 
      },
    });

    if (existingFreemiumCount >= 2) {
      throw new Error(`Freemium limit reached for school group "${cleanSchoolGroup}": Maximum of 2 Freemium departments allowed. Please upgrade to Pro or Corporate.`);
    }
  }

  // Create the new tenant organization
  const organization = await prisma.organization.create({
    data: {
      name: data.name,
      subdomain: cleanSubdomain,
      type: data.type,
      tier: tier,
      schoolGroup: cleanSchoolGroup,
      status: 'Active',
    },
  });

  revalidatePath('/dashboard/provisions');
  return { success: true, organization };
}

// 🚀 2. DYNAMICALLY UPDATE ORGANIZATION TIER
export async function updateOrganizationTier(organizationId: string, newTier: 'Freemium' | 'Pro' | 'Corporate') {
  await verifySuperAdmin();

  const currentOrg = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!currentOrg) throw new Error("Organization not found.");

  // If changing to Freemium, verify that the school group won't exceed 2 tenants
  if (newTier === 'Freemium' && currentOrg.tier !== 'Freemium') {
    const freemiumCount = await prisma.organization.count({ 
      where: { 
        schoolGroup: currentOrg.schoolGroup, 
        tier: 'Freemium' 
      } 
    });
    if (freemiumCount >= 2) {
      throw new Error(`Cannot switch to Freemium: School group "${currentOrg.schoolGroup}" already has 2 Freemium tenants.`);
    }
  }

  await prisma.organization.update({
    where: { id: organizationId },
    data: { tier: newTier },
  });

  revalidatePath('/dashboard/provisions');
  return { success: true, message: `Tenant tier successfully updated to ${newTier}.` };
}

// 🚀 3. UPDATE ORGANIZATION STATUS
export async function updateOrganizationStatus(organizationId: string, newStatus: 'Active' | 'Inactive' | 'Archived') {
  await verifySuperAdmin();
  await prisma.organization.update({
    where: { id: organizationId },
    data: { status: newStatus },
  });
  revalidatePath('/dashboard/provisions');
  return { success: true, message: `Tenant successfully marked as ${newStatus}.` };
}

// 🚀 4. PERMANENTLY DELETE TENANT AND RELATED DATA
export async function deleteOrganization(organizationId: string) {
  await verifySuperAdmin();
  await prisma.$transaction(async (tx) => {
    await tx.collection.deleteMany({ where: { organizationId } });
    await tx.enrollment.deleteMany({ where: { organizationId } });
    await tx.student.deleteMany({ where: { organizationId } });
    await tx.fund.deleteMany({ where: { organizationId } });
    await tx.tenantUser.deleteMany({ where: { organizationId } });
    await tx.systemLog.deleteMany({ where: { organizationId } });
    await tx.organization.delete({ where: { id: organizationId } });
  });
  revalidatePath('/dashboard/provisions');
  return { success: true, message: "Tenant organization permanently deleted." };
}