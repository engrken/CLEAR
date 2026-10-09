"use server";

import { prisma } from '@/lib/prisma';
import { requireTabAccess } from '@/lib/permissions';
import { revalidatePath } from 'next/cache';

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