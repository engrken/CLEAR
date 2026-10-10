"use server";

import { prisma } from '@/lib/prisma';
import { requireTabAccess } from '@/lib/permissions';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { put, del } from '@vercel/blob';

// =========================================================================
// HELPER FUNCTIONS (Internal to this module)
// =========================================================================

function money(val: any, fieldName: string): number {
  const parsed = parseFloat(val);
  if (isNaN(parsed)) throw new Error(`Invalid monetary value for ${fieldName}`);
  return parsed;
}

// =========================================================================
// INITIAL FUNDS ACTIONS
// =========================================================================

export async function saveInitialFunds(
  department: string,
  ay: string,
  term: string,
  funds: {
    fundName: string;
    amount: number;
  }[]
) {
  // 1. Verify Permission via Shared Guard
  const customUser = await requireTabAccess("tab-setup");
  const officerName = customUser.fullName || customUser.email || "System Administrator";

  // 2. Resolve Organization ID
  const organization = await prisma.organization.findUnique({
    where: { subdomain: department.toLowerCase() }
  });

  if (!organization) {
    throw new Error(`Organization subdomain "${department}" not found.`);
  }
  const orgId = organization.id;

  // 3. Validate Inputs
  if (!Array.isArray(funds)) {
    throw new Error("Invalid fund configuration.");
  }

  // Deduplicate and aggregate fund names
  const combinedFunds = new Map<string, number>();

  for (const fund of funds) {
    const fundName = String(fund.fundName || "").trim();
    if (!fundName) continue;

    const amount = money(fund.amount, `Initial allocation for ${fundName}`);
    combinedFunds.set(fundName, (combinedFunds.get(fundName) || 0) + amount);
  }

  const validFunds = Array.from(combinedFunds.entries()).map(([fundName, amount]) => ({
    fundName,
    amount,
  }));

  // 4. Execute Database Transaction
  await prisma.$transaction(async (tx) => {
    // Clear out existing funds for this specific term/AY to allow clean overwrite
    await tx.fund.deleteMany({
      where: {
        organizationId: orgId,
        academicYear: ay,
        term,
      },
    });

    if (validFunds.length > 0) {
      await tx.fund.createMany({
        data: validFunds.map((f) => ({
          organizationId: orgId,
          academicYear: ay,
          term,
          fundName: f.fundName,
          initialAllocation: f.amount,
        })),
      });
    }
  });

  // 5. Audit Log (If SystemLog table exists)
  try {
    await prisma.systemLog.create({
      data: {
        organizationId: orgId,
        user: officerName,
        action: "SETUP_FUNDS",
        details: `Configured ${validFunds.length} target funds for ${term} (${ay}).`,
      }
    });
  } catch (error) {
    console.warn("System logging failed (table might not exist yet):", error);
  }
  
  // 6. Revalidate Cache
  revalidatePath(`/department/${department}/setup`);
  revalidatePath(`/department/${department}`);
}

// =========================================================================
// ORGANIZATION BRANDING ACTIONS
// =========================================================================

export async function updateEntityLogo(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error('401 Unauthorized');

  const organizationId = formData.get('organizationId') as string;
  const logoFile = formData.get('logo') as File | null;

  if (!organizationId || !logoFile || logoFile.size === 0) {
    return { success: false, message: 'Organization ID and a new file are required.' };
  }

  try {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { logo: true, subdomain: true }
    });

    if (!org) throw new Error('Organization not found.');

    // 1. Delete the old logo from Vercel Blob
    if (org.logo && org.logo.includes('vercel-storage.com')) {
      try {
        await del(org.logo);
      } catch (err) {
        console.warn('Could not delete old logo from Blob storage.', err);
      }
    }

    // 2. Upload the new logo to Vercel Blob
    const extension = logoFile.name.split('.').pop() || 'png';
    const filename = `logos/${org.subdomain}_logo_${Date.now()}.${extension}`;
    
    const blob = await put(filename, logoFile, { 
      access: 'public',
      addRandomSuffix: false 
    });
    
    const newLogoPath = blob.url;

    // 3. Update the database
    await prisma.organization.update({
      where: { id: organizationId },
      data: { logo: newLogoPath }
    });

    revalidatePath('/dashboard/provisions');
    revalidatePath(`/department/${org.subdomain}/setup`);
    revalidatePath(`/department/${org.subdomain}`);
    
    return { success: true, message: 'Logo updated successfully!' };
  } catch (error: any) {
    console.error(error);
    return { success: false, message: error.message || 'Failed to update logo.' };
  }
}