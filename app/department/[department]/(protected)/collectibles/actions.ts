// /app/department/[department]/(protected)/collectibles/actions.ts

"use server";

import { prisma } from '@/lib/prisma';
import { requireTabAccess } from '@/lib/permissions';
import { logSystemAction } from '@/lib/logger';
import { revalidatePath } from 'next/cache';

// =========================================================================
// HELPER FUNCTIONS (Internal to this module)
// =========================================================================

function money(val: any, fieldName: string): number {
  const parsed = parseFloat(val);
  if (isNaN(parsed)) throw new Error(`Invalid monetary value for ${fieldName}`);
  return Math.round(parsed * 100) / 100;
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
  const cleanDepartment = decodeURIComponent(department).trim().toLowerCase();

  // 1. Verify Permission via Shared Guard & Tenant scope
  const customUser = await requireTabAccess("tab-collectibles", cleanDepartment);
  const officerName = customUser.name || customUser.fullName || customUser.email || "System Administrator";

  // 2. Resolve Organization ID
  const organization = await prisma.organization.findUnique({
    where: { subdomain: cleanDepartment }
  });

  if (!organization) {
    throw new Error(`Organization subdomain "${cleanDepartment}" not found.`);
  }

  const orgId = organization.id;

  // 3. Validate Inputs
  const amountDue = money(payload.amountDue, "Amount due");

  if (amountDue <= 0) {
    throw new Error("Amount due must be greater than zero.");
  }

  if (!payload.studentId || !payload.studentName) {
    throw new Error("Valid student identification is required.");
  }

  // 4. Create Database Record conforming strictly to the Collectible model schema fields
  const formattedDescription = `${payload.itemDescription} - ${payload.studentName} (${payload.studentId})`;

  await prisma.collectible.create({
    data: {
      organizationId: orgId,
      academicYear: payload.ay,
      term: payload.term,
      category: String(payload.category || "").trim(),
      headcount: 1,
      balanceDue: amountDue,
      status: "Unpaid",
      encodedBy: officerName,
    },
  });

  // 5. Audit Logging
  await logSystemAction(
    orgId,
    officerName,
    "ASSESS_STUDENT_DUE",
    `Assessed ₱${amountDue.toFixed(2)} (${payload.itemDescription}) for student ${payload.studentName} (${payload.studentId}).`
  );

  // 6. Revalidate Cache
  revalidatePath(`/department/${cleanDepartment}/collectibles`);

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
  const cleanDepartment = decodeURIComponent(department).trim().toLowerCase();

  // 1. Verify Permission via Shared Guard
  const customUser = await requireTabAccess("tab-collectibles", cleanDepartment);
  const officerName = customUser.name || customUser.fullName || customUser.email || "System Administrator";

  // 2. Resolve Organization ID
  const organization = await prisma.organization.findUnique({
    where: { subdomain: cleanDepartment }
  });

  if (!organization) {
    throw new Error(`Organization subdomain "${cleanDepartment}" not found.`);
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
      balanceDue: money(r?.total || 0, "Bulk total"),
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

  // 5. Audit Log
  await logSystemAction(
    orgId,
    officerName,
    "SAVE_BULK_COLLECTIBLES",
    `Assessed bulk collectibles across ${prepared.length} categories.`
  );

  // 6. Revalidate Cache
  revalidatePath(`/department/${cleanDepartment}/collectibles`);
}