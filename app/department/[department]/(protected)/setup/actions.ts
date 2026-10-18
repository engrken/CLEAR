// /app/department/[department]/(protected)/setup/actions.ts



"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireTabAccess } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { put, del } from "@vercel/blob";
import { getPeriodLedger, toCents, parseRolloverMetadata, matchesRolloverSource } from "../realign/ledger";
import { PENALTY_FUND_NAME } from "@/lib/penalty-fund";
import { inspectFundUsage } from "./fund-policy";
import { configurationForYear, isValidPeriod } from "@/lib/academic-periods";

// =========================================================================
// HELPERS
// =========================================================================

function money(val: unknown, fieldName: string): number {
  const parsed = Number(val);

  if (!Number.isFinite(parsed)) {
    throw new Error(`${fieldName} must be a valid number.`);
  }

  if (parsed < 0) {
    throw new Error(`${fieldName} cannot be negative.`);
  }

  return Math.round((parsed + Number.EPSILON) * 100) / 100;
}

function normalizeDepartment(department: string): string {
  let clean: string;

  try {
    clean = decodeURIComponent(String(department || ""));
  } catch {
    throw new Error("Invalid department identifier.");
  }

  clean = clean.trim().toLowerCase();

  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(clean)) {
    throw new Error("Invalid department identifier.");
  }

  return clean;
}

async function requireSetupOrganization(department: string) {
  const cleanDepartment = normalizeDepartment(department);

  const user = await requireTabAccess("tab-setup", cleanDepartment);

  const organization = await prisma.organization.findUnique({
    where: { subdomain: cleanDepartment },
    select: {
      id: true,
      subdomain: true,
    },
  });

  if (!organization) {
    throw new Error("Department organization not found.");
  }

  const actor = user as unknown as {
    fullName?: string | null;
    name?: string | null;
    email?: string | null;
  };

  return {
    cleanDepartment,
    organization,
    officerName: String(
      actor.fullName ||
        actor.name ||
        actor.email ||
        "System Administrator"
    ).trim(),
  };
}

// =========================================================================
// INITIAL FUNDS
// =========================================================================

/**
 * Update opening fund accounts INDIVIDUALLY, preserving IDs and every existing
 * financial record. Referenced funds are immutable; unreferenced funds can be
 * renamed, removed, or corrected with an audit reason when the term is active.
 * New funds during an active term must open at zero and be funded via Realignment.
 */
export async function saveInitialFunds(
  department: string,
  ay: string,
  term: string,
  funds: { id?: string; fundName: string; amount: number }[],
  adjustmentReason = "",
  savedFundSnapshot: { id: string; fundName: string; amount: number }[] = [],
) {
  const { cleanDepartment, organization, officerName } = await requireSetupOrganization(department);
  const academicYear = String(ay || "").trim();
  const academicTerm = String(term || "").trim();
  const calendarRecord = await prisma.academicPeriodConfig.findMany({
    where: { organizationId: organization.id },
    select: { academicYear: true, mode: true, includeSummer: true },
  });
  const calendarMap = Object.fromEntries(calendarRecord.map(row => [row.academicYear, {
    mode: row.mode as "Semester" | "Trimester" | "FullYear", includeSummer: row.includeSummer,
  }]));
  if (!isValidPeriod(academicYear, academicTerm, configurationForYear(academicYear, calendarMap))) {
    throw new Error("Choose an accounting period enabled in System Setup.");
  }
  if (!Array.isArray(funds) || funds.length > 100) {
    throw new Error("Provide up to 100 valid fund pools.");
  }
  const explanation = String(adjustmentReason || "").trim();
  if (explanation.length > 500) throw new Error("Adjustment reason must not exceed 500 characters.");
  const names = new Set<string>();
  const ids = new Set<string>();
  const prepared = funds.map(row => {
    const rawName = String(row?.fundName || "").trim();
    const fundName = rawName.toLowerCase() === PENALTY_FUND_NAME.toLowerCase()
      ? PENALTY_FUND_NAME : rawName;
    if (!fundName || fundName.length > 150 || /[\r\n]/.test(fundName)) {
      throw new Error("Each fund pool needs a valid name (1–150 characters).");
    }
    const nkey = fundName.toLowerCase();
    if (names.has(nkey)) throw new Error(`Duplicate fund name: ${fundName}`);
    names.add(nkey);
    const id = typeof row.id === "string" && row.id.trim() ? row.id.trim() : undefined;
    if (id && ids.has(id)) throw new Error(`Duplicate fund identity for ${fundName}.`);
    if (id) ids.add(id);
    const amount = money(row.amount, fundName);
    if (fundName === PENALTY_FUND_NAME && amount !== 0) {
      throw new Error("Penalty Fund must have a zero opening allocation; penalty receipts fund it.");
    }
    return { id, fundName, amount };
  });
  if (!names.has(PENALTY_FUND_NAME.toLowerCase())) {
    prepared.push({ id: undefined, fundName: PENALTY_FUND_NAME, amount: 0 });
  }
  if (!prepared.length) throw new Error("At least the system Penalty Fund must exist.");
  if (!Array.isArray(savedFundSnapshot) || savedFundSnapshot.some(row =>
    !row || typeof row.id !== "string" || typeof row.fundName !== "string" ||
    !Number.isFinite(row.amount))) {
    throw new Error("Invalid fund-list revision. Refresh the Setup page.");
  }
  const known = new Map(savedFundSnapshot.map(row => [row.id, row]));

  const result = await prisma.$transaction(async tx => {
    const where = { organizationId: organization.id, academicYear, term: academicTerm };
    const existing = await tx.fund.findMany({ where, orderBy: { fundName: "asc" } });
    const usage = await inspectFundUsage(tx, organization.id, existing);
    const periodKey = usage.periodKey(academicYear, academicTerm);
    if (usage.closedPeriods.has(periodKey)) {
      throw new Error("This term has an active carry-over and is closed. Reverse the rollover before modifying its fund structure.");
    }
    // Prevent a stale browser tab from deleting pools somebody else just added.
    if (existing.some(row => {
      const previous = known.get(row.id);
      return !previous || previous.fundName !== row.fundName ||
        Math.round(previous.amount * 100) !== Math.round(Number(row.initialAllocation) * 100);
    }) || savedFundSnapshot.length !== existing.length) {
      throw new Error("The fund list or an opening allocation changed since this page was loaded. Refresh Setup and try again.");
    }
    const activity = usage.periodsWithActivity.has(periodKey);
    const existingById = new Map(existing.map(row => [row.id,row]));
    const suppliedIds = new Set(prepared.flatMap(row => row.id ? [row.id] : []));
    for (const id of suppliedIds) {
      if (!existingById.has(id)) throw new Error("An existing fund was changed in another session. Refresh Setup.");
    }
    const changes: string[] = [];
    let needsReason = false;

    // Validate ALL changes before issuing ANY write.
    for (const saved of existing) {
      const incoming = prepared.find(row => row.id === saved.id);
      const reason = usage.referenced.get(usage.refKey(academicYear,academicTerm,saved.fundName));
      const reserved = saved.fundName.toLowerCase() === PENALTY_FUND_NAME.toLowerCase();
      const changed = !incoming || incoming.fundName !== saved.fundName ||
        Math.round(incoming.amount * 100) !== Math.round(saved.initialAllocation * 100);
      if (!changed) continue;
      if (reserved || reason) {
        throw new Error(`${saved.fundName} is protected (${reserved ? "System Penalty Fund" : reason}). Its name, opening allocation, and record cannot be changed.`);
      }
      if (!incoming) {
        changes.push(`REMOVED ${saved.fundName} (opening ₱${Number(saved.initialAllocation).toFixed(2)})`);
      } else {
        changes.push(`EDITED ${saved.fundName} -> ${incoming.fundName}; opening ₱${Number(saved.initialAllocation).toFixed(2)} -> ₱${incoming.amount.toFixed(2)}`);
      }
      if (activity) needsReason = true;
    }
    for (const row of prepared.filter(row => !row.id)) {
      const linked = usage.referenced.get(usage.refKey(academicYear,academicTerm,row.fundName));
      if (linked) throw new Error(`${row.fundName} already appears in ${linked}, but has no saved Fund row. Reconcile this legacy account before creating it.`);
      if (activity && row.amount !== 0) {
        throw new Error(`New fund ${row.fundName} must start at ₱0.00 during an active term. Use Realignment to transfer existing funds.`);
      }
      changes.push(`CREATED ${row.fundName} (opening ₱${row.amount.toFixed(2)})`);
    }
    if (activity && needsReason && explanation.length < 10) {
      throw new Error("An adjustment reason of at least 10 characters is required to change or remove an unused existing fund during an active term.");
    }
    const resultingNames = new Set(prepared.map(row => row.fundName.toLowerCase()));
    if (resultingNames.size !== prepared.length) throw new Error("Duplicate fund name.");
    if (!changes.length) return { created: 0, changed: 0, message: "No fund changes to save." };

    // Compare with the pre-adjustment ledger to reject NEW balance deficiencies,
    // while not blocking a harmless zero-opening pool because of older errors.
    const openingChanged = existing.some(saved => {
      const incoming = prepared.find(row => row.id === saved.id);
      return !incoming ? Number(saved.initialAllocation) !== 0 :
        Math.round(incoming.amount * 100) !== Math.round(Number(saved.initialAllocation) * 100);
    });
    const baselineLedger = activity && openingChanged
      ? await getPeriodLedger(tx, organization.id, academicYear, academicTerm) : null;
    // Remove unused funds first to free up names, then update by immutable ID.
    for (const saved of existing) {
      if (!suppliedIds.has(saved.id)) {
        await tx.fund.delete({ where: { id: saved.id } });
      }
    }
    let created = 0;
    for (const row of prepared) {
      if (row.id) {
        const saved = existingById.get(row.id)!;
        if (saved.fundName !== row.fundName ||
            Math.round(Number(saved.initialAllocation) * 100) !== Math.round(row.amount * 100)) {
          await tx.fund.update({ where: { id: row.id }, data: { fundName: row.fundName, initialAllocation: row.amount } });
        }
      } else {
        await tx.fund.create({ data: { ...where, fundName: row.fundName, initialAllocation: row.amount, currentBalance: 0 } });
        created++;
      }
    }
    if (baselineLedger) {
      const ledger = await getPeriodLedger(tx, organization.id, academicYear, academicTerm);
      const previousBalances = new Map(baselineLedger.funds.map(f => [f.name, Math.round(f.balance * 100)]));
      if (ledger.funds.some(f => {
        const now = Math.round(f.balance * 100);
        const before = previousBalances.get(f.name) ?? 0;
        return now < 0 && now < before;
      }) ||
      Math.round(ledger.totalRemaining * 100) < Math.round(ledger.cashierBalance * 100) &&
      Math.round(ledger.totalRemaining * 100) < Math.round(baselineLedger.totalRemaining * 100)) {
        throw new Error("This opening-allocation change would worsen a negative balance or cashier-custody shortfall. Use Realignment or reconcile the records first.");
      }
    }
    await tx.systemLog.create({ data: {
      organizationId: organization.id,
      user: officerName,
      action: "SETUP_FUNDS",
      details: `Fund-pool changes for ${academicTerm} (${academicYear}): ${changes.join("; ")}. Reason: ${explanation || "Initial configuration / zero-opening pool creation"}`,
    }});
    return { created, changed: changes.length, message: `${changes.length} fund-pool change(s) saved with audit history.` };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000, maxWait: 10000 });

  const root = `/department/${cleanDepartment}`;
  for (const route of ["", "/setup", "/setup/collections", "/summary", "/reports", "/advances", "/realign", "/liquidations", "/collections", "/cashier-remittance", "/collectibles"]) {
    revalidatePath(root + route);
  }
  return { success: true, ...result };
}

// =========================================================================
// ORGANIZATION BRANDING
// =========================================================================

export async function updateEntityLogo(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    throw new Error("401 Unauthorized.");
  }

  const organizationId = String(
    formData.get("organizationId") || ""
  ).trim();

  const logoFile = formData.get("logo");

  if (
    !organizationId ||
    !(logoFile instanceof File) ||
    logoFile.size === 0
  ) {
    return {
      success: false,
      message: "Organization ID and a new file are required.",
    };
  }

  // Resolve the organization and authorize the current user for its setup.
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      subdomain: true,
      logo: true,
    },
  });

  if (!org) {
    return {
      success: false,
      message: "Organization not found.",
    };
  }

  const {
    organization,
    cleanDepartment,
  } = await requireSetupOrganization(org.subdomain);

  if (organization.id !== org.id) {
    throw new Error("Organization access validation failed.");
  }

  // Only allow common image formats.
  const allowedTypes: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
  };

  const extension = allowedTypes[logoFile.type];

  if (!extension) {
    return {
      success: false,
      message: "Upload a PNG, JPEG, or WebP image.",
    };
  }

  if (logoFile.size > 5 * 1024 * 1024) {
    return {
      success: false,
      message: "The logo must not exceed 5 MB.",
    };
  }

  try {
    const filename =
      `logos/${org.subdomain}_logo_${Date.now()}.${extension}`;

    const blob = await put(filename, logoFile, {
      access: "public",
      addRandomSuffix: false,
      contentType: logoFile.type,
    });

    await prisma.organization.update({
      where: { id: org.id },
      data: { logo: blob.url },
    });

    // Delete the previous image only after the database update succeeds.
    if (
      org.logo &&
      org.logo.includes("vercel-storage.com") &&
      org.logo !== blob.url
    ) {
      try {
        await del(org.logo);
      } catch (error) {
        console.warn(
          "Could not delete the previous organization logo.",
          error
        );
      }
    }

    revalidatePath("/dashboard/provisions");
    revalidatePath(`/department/${cleanDepartment}/setup`);
    revalidatePath(`/department/${cleanDepartment}`);

    return {
      success: true,
      message: "Logo updated successfully.",
    };
  } catch (error: unknown) {
    console.error("Organization logo update failed:", error);

    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to update the organization logo.",
    };
  }
}

// =========================================================================
// PERSISTENT ROLLOVER REVERSAL
// =========================================================================

export async function reverseRollover(
  department: string,
  transferId: string,
  reason: string
) {
  const { cleanDepartment, organization, officerName } = await requireSetupOrganization(department);
  const id = String(transferId || "").trim();
  const explanation = String(reason || "").trim();
  if (!id || explanation.length < 5 || explanation.length > 1000) {
    throw new Error("Choose a rollover and provide a reversal reason of 5–1,000 characters.");
  }
  const reversal = await prisma.$transaction(async tx => {
    const transfer = await tx.fundTransfer.findFirst({
      where: { id, organizationId: organization.id },
    });
    if (!transfer || !/\sRollover$/i.test(String(transfer.sourceFund || ""))) {
      throw new Error("An authorized rollover record was not found.");
    }
    if (toCents(transfer.amount) <= 0) throw new Error("The rollover amount is invalid.");
    const closure = await tx.academicPeriodTransition.findFirst({
      where: { organizationId: organization.id, transferId: id, status: "Closed" },
    });
    if (closure) {
      const active = await tx.organization.findUnique({ where: { id: organization.id },
        select: { activeAy: true, activeTerm: true } });
      if (!active || active.activeAy !== closure.destinationAY || active.activeTerm !== closure.destinationTerm) {
        throw new Error("Destination is no longer the active period. Reopen transitions in reverse order with accounting approval.");
      }
    }
    const previous = await tx.voidTransaction.findFirst({
      where: { organizationId: organization.id, transactionType: "ROLLOVER_REVERSAL", referenceId: id },
    });
    if (previous) throw new Error("This rollover has already been reversed.");
    const destination = await getPeriodLedger(tx, organization.id, transfer.academicYear, transfer.term);
    // A destination that has since been carried forward must be reversed FIRST.
    if (destination.activeRollover) {
      throw new Error("The destination term has already been carried forward. Reverse its subsequent rollover first.");
    }
    const creditedPool = destination.funds.find(f => f.name === transfer.destinationFund);
    if (!creditedPool || toCents(creditedPool.balance) < toCents(transfer.amount)) {
      throw new Error("The destination fund no longer has enough available balance to reverse this rollover. Reconcile expenditures and realignments first.");
    }
    const metadata = parseRolloverMetadata(transfer.reason);
    if (metadata?.copiedFeeIds?.length) {
      const [receipts, dues, penalties, advances, audits, remittances, cashier, enrollments] = await Promise.all([
        tx.collection.count({ where: { organizationId: organization.id, academicYear: transfer.academicYear, term: transfer.term } }),
        tx.collectible.count({ where: { organizationId: organization.id, academicYear: transfer.academicYear, term: transfer.term } }),
        tx.penalty.count({ where: { organizationId: organization.id, academicYear: transfer.academicYear, term: transfer.term } }),
        tx.cashAdvance.count({ where: { organizationId: organization.id, academicYear: transfer.academicYear, term: transfer.term } }),
        tx.audit.count({ where: { organizationId: organization.id, academicYear: transfer.academicYear, term: transfer.term } }),
        tx.onlineRemittance.count({ where: { organizationId: organization.id, academicYear: transfer.academicYear, term: transfer.term } }),
        tx.cashierRemittance.count({ where: { organizationId: organization.id, academicYear: transfer.academicYear, term: transfer.term } }),
        tx.enrollment.count({ where: { organizationId: organization.id, academicYear: transfer.academicYear, term: transfer.term } }),
      ]);
      if ([receipts, dues, penalties, advances, audits, remittances, cashier, enrollments].some(n => n > 0)) {
        throw new Error("Cannot reverse a rollover that copied collection fees after destination-period activity has begun. Reconcile the destination period and fee schedule first.");
      }
      const saved = await tx.collectionSetup.findMany({ where: {
        organizationId: organization.id, academicYear: transfer.academicYear,
        term: transfer.term, id: { in: metadata.copiedFeeIds },
      }});
      const snapshots = metadata.copiedFeeSnapshot || [];
      if (saved.length !== metadata.copiedFeeIds.length || snapshots.length !== saved.length ||
        saved.some(f => !snapshots.some(original => original.id === f.id &&
          original.category === f.category && original.name === f.name &&
          original.amount === f.amount && original.targetFund === f.targetFund &&
          original.isPackage === f.isPackage))) {
        throw new Error("Copied destination fees have been changed or removed. Reversal requires accounting reconciliation; no records were changed.");
      }
      await tx.collectionSetup.deleteMany({ where: {
        organizationId: organization.id, id: { in: metadata.copiedFeeIds },
      }});
    }
    const row = await tx.voidTransaction.create({
      data: {
        organizationId: organization.id,
        transactionType: "ROLLOVER_REVERSAL",
        referenceId: id,
        amount: transfer.amount,
        reason: explanation,
        voidedBy: officerName,
      },
    });
    if (closure) {
      await tx.academicPeriodTransition.update({ where: { id: closure.id },
        data: { status: "Reopened", reopenedAt: new Date() } });
      await tx.organization.update({ where: { id: organization.id },
        data: { activeAy: closure.sourceAY, activeTerm: closure.sourceTerm } });
    }
    await tx.systemLog.create({
      data: {
        organizationId: organization.id,
        user: officerName,
        action: "ROLLOVER_REVERSAL",
        details: `Reversed rollover ${id}; ₱${Number(transfer.amount).toFixed(2)}; ${transfer.sourceFund} -> ${transfer.destinationFund}; destination ${transfer.term} (${transfer.academicYear}); reason: ${explanation}`,
      },
    });
    return { reversedBy: row.voidedBy, reversedAt: row.date.toISOString().slice(0, 10) };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20000 });

  const root = `/department/${cleanDepartment}`;
  for (const route of ["", "/setup", "/setup/collections", "/collections", "/collectibles", "/summary", "/realign", "/reports", "/advances", "/liquidations"]) {
    revalidatePath(root + route);
  }
  return { success: true, message: "Rollover reversal recorded successfully.", ...reversal };
}
