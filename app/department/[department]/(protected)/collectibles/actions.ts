"use server";

import { prisma } from '@/lib/prisma';
import { requireTabAccess } from '@/lib/permissions';
import { revalidatePath } from 'next/cache';

// =========================================================================
// HELPER FUNCTIONS (Internal to this module)
// =========================================================================

// Safe money parser
function money(val: any, fieldName: string): number {
  const parsed = parseFloat(val);
  if (isNaN(parsed)) throw new Error(`Invalid monetary value for ${fieldName}`);
  return parsed;
}

// =========================================================================
// COLLECTIBLES ACTIONS
// =========================================================================

export async function assessStudentDue(
  department: string,
  payload: {
    studentId: string;
    studentName: string;
    category: string;
    itemDescription: string;
    amountDue: number;
    fundAllocation: string;
    date: string;
    ay: string;
    term: string;
  }
) {
  // 1. Verify Permission via Shared Guard
  const customUser = await requireTabAccess("tab-collectibles");
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
  const amountDue = money(payload.amountDue, "Amount due");

  if (amountDue <= 0) {
    throw new Error("Amount due must be greater than zero.");
  }

  // 4. Create Database Record
  /*
   * Collectible schema currently contains only:
   * id, organizationId, category, AY, term,
   * headcount, balanceDue, status, encodedBy.
   *
   * Therefore studentId, studentName, itemDescription,
   * fundAllocation and date are intentionally NOT written
   * here because those fields do not exist in the model.
   */
  await prisma.collectible.create({
    data: {
      organizationId: orgId,
      academicYear: payload.ay,
      term: payload.term,
      category: String(payload.category || "").trim(),
      balanceDue: amountDue,
      status: "Unpaid",
      encodedBy: officerName,
    },
  });

  // 5. Revalidate Cache
  revalidatePath(`/department/${department}/collectibles`);

  return {
    success: true,
    message: "Student due successfully assessed.",
  };
}

export async function saveBulkCollectibles(
  department: string,
  records: any[],
  ay: string,
  term: string
) {
  // 1. Verify Permission via Shared Guard
  const customUser = await requireTabAccess("tab-collectibles");
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
  if (!Array.isArray(records)) {
    throw new Error("Invalid collectible records.");
  }

  const prepared = records
    .map((r: any) => ({
      organizationId: orgId,
      academicYear: ay,
      term,
      category: String(r?.category || "").trim(),
      headcount: Math.max(1, parseInt(r?.headcount, 10) || 1),
      balanceDue: Math.max(0, Number.parseFloat(r?.total) || 0),
      status: "Outstanding",
      encodedBy: officerName,
    }))
    .filter((r) => r.category !== "");

  // 4. Create Database Records
  if (prepared.length > 0) {
    await prisma.collectible.createMany({
      data: prepared,
    });
  }

  // 5. Audit Log (If SystemLog table exists)
  try {
    await prisma.systemLog.create({
      data: {
        organizationId: orgId,
        user: officerName,
        action: "SAVE_COLLECTIBLES",
        details: `Assessed bulk collectibles across ${prepared.length} categories.`,
      }
    });
  } catch (error) {
    console.warn("System logging failed (table might not exist yet):", error);
  }

  // 6. Revalidate Cache
  revalidatePath(`/department/${department}/collectibles`);
}