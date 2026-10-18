"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireTabAccess } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import {
  academicYearStart, isCalendarMode, periodsFor,
  type CalendarConfig,
} from "@/lib/academic-periods";

/** Per-tenant, per-academic-year academic calendars; never re-tag historical transactions. */
export async function saveAcademicPeriodConfig(
  department: string,
  ay: string,
  mode: string,
  includeSummer: boolean,
) {
  const slug = String(department).trim().toLowerCase();
  const officer = await requireTabAccess("tab-setup", slug);
  academicYearStart(ay);
  if (!isCalendarMode(mode)) throw new Error("Choose Full-Year, Semester, or Trimester.");
  const config: CalendarConfig = { mode, includeSummer: mode === "Semester" && includeSummer };
  const terms = periodsFor(config);
  const organization = await prisma.organization.findUnique({
    where: { subdomain: slug }, select: { id: true, activeAy: true, activeTerm: true },
  });
  if (!organization) throw new Error("Organization not found.");
  const actor = String((officer as any).fullName || officer.name || officer.email || "Authorized Officer");

  const result = await prisma.$transaction(async tx => {
    // Reject reconfiguration when it would strand existing financial data in an invalid term.
    const where = { organizationId: organization.id, academicYear: ay };
    const [funds, fees, receipts, dues, fines, advances, liquidations, cashier, remittances, enrollments, transfers] = await Promise.all([
      tx.fund.findMany({ where, select: { term: true } }),
      tx.collectionSetup.findMany({ where, select: { term: true } }),
      tx.collection.findMany({ where, select: { term: true } }),
      tx.collectible.findMany({ where, select: { term: true } }),
      tx.penalty.findMany({ where, select: { term: true } }),
      tx.cashAdvance.findMany({ where, select: { term: true } }),
      tx.audit.findMany({ where, select: { term: true } }),
      tx.cashierRemittance.findMany({ where, select: { term: true } }),
      tx.onlineRemittance.findMany({ where, select: { term: true } }),
      tx.enrollment.findMany({ where, select: { term: true } }),
      tx.fundTransfer.findMany({ where, select: { term: true } }),
    ]);
    const usedTerms = new Set(
      [funds,fees,receipts,dues,fines,advances,liquidations,cashier,remittances,enrollments,transfers]
        .flat().map(r => r.term),
    );
    const incompatible = [...usedTerms].filter(term => !terms.includes(term));
    if (incompatible.length) {
      throw new Error(`Cannot switch calendar for ${ay}; existing records use ${incompatible.join(", ")}. Keep the original calendar for this year and configure a future academic year instead.`);
    }
    const previous = await tx.academicPeriodConfig.findUnique({ where: {
      organizationId_academicYear: { organizationId: organization.id, academicYear: ay },
    } });
    const saved = await tx.academicPeriodConfig.upsert({
      where: { organizationId_academicYear: { organizationId: organization.id, academicYear: ay } },
      create: { organizationId: organization.id, academicYear: ay, mode: config.mode, includeSummer: config.includeSummer },
      update: { mode: config.mode, includeSummer: config.includeSummer },
    });
    // When configuring the active year, keep the activeTerm consistent with its calendar.
    if (organization.activeAy === ay && !terms.includes(organization.activeTerm)) {
      await tx.organization.update({ where: { id: organization.id }, data: { activeTerm: terms[0] } });
    }
    await tx.systemLog.create({ data: {
      organizationId: organization.id, user: actor, action: "ACADEMIC_CALENDAR_UPDATE",
      details: `${ay}: ${previous ? `${previous.mode} / Summer:${previous.includeSummer}` : "Legacy default"} -> ${config.mode} / Summer:${config.includeSummer}. Allowed terms: ${terms.join(", ")}`,
    }});
    return saved;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  revalidatePath(`/department/${slug}`, "layout");
  for (const route of ["/setup", "/realign", "/collections", "/liquidations"]) {
    revalidatePath(`/department/${slug}${route}`);
  }
  return { success: true, mode: result.mode, includeSummer: result.includeSummer };
}
