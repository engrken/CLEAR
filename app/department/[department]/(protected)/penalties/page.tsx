// app/department/[department]/(protected)/penalties/page.tsx
import { moneyNumber } from "@/lib/money-precision";
import { prisma } from "@/lib/prisma";
import { requireTabAccess, requireOrgAdmin } from "@/lib/permissions";
import { getPeriodLedger } from "../realign/ledger";
import PenaltiesManager from "./PenaltiesManager";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Centralized Liquidation of Expenses & Audit Records",
};

export const dynamic = "force-dynamic";

export default async function PenaltiesPage({
  params,
  searchParams,
}: {
  params: Promise<{ department: string }>;
  searchParams?: Promise<{ ay?: string; term?: string }>;
}) {
  const { department } = await params;
  let cleanDepartment: string;
  try {
    cleanDepartment = decodeURIComponent(department).trim().toLowerCase();
  } catch {
    return <div className="alert alert-danger p-4">Invalid department identifier.</div>;
  }

  await requireTabAccess("tab-penalties", cleanDepartment);

  const organization = await prisma.organization.findUnique({
    where: { subdomain: cleanDepartment },
    select: { id: true, activeAy: true, activeTerm: true },
  });
  if (!organization) {
    return (
      <div className="alert alert-danger p-4 shadow-sm border-secondary">
        <h4 className="fw-bold mb-2">Department Not Found</h4>
        <p className="small mb-0">The requested department does not exist.</p>
      </div>
    );
  }

  const selection = searchParams ? await searchParams : {};
  const ay = String(selection.ay || organization.activeAy || "A.Y. 2026 - 2027").trim();
  const term = String(selection.term || organization.activeTerm || "1st Sem").trim();

  const [students, records, ledger, canVoid, canReconcile] = await Promise.all([
    prisma.student.findMany({
      where: { organizationId: organization.id },
      select: { id: true, studentId: true, fullName: true, email: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.penalty.findMany({
      where: { organizationId: organization.id, academicYear: ay, term },
      orderBy: [{ date: "desc" }, { id: "desc" }],
    }),
    getPeriodLedger(prisma, organization.id, ay, term),
    requireTabAccess("tab-void", cleanDepartment).then(() => true).catch(() => false),
    requireOrgAdmin(cleanDepartment).then(() => true).catch(() => false),
  ]);

  // Voided penalties remain in the DB and SystemLog / VoidTransaction for audit,
  // but must not be counted or displayed in the operational Penalty Logs.
  const penalties = records.filter(p => !/VOID|CANCEL/i.test(String(p.status || "")));
  const periodClosed = Boolean(ledger.activeRollover);

  // Read-only history is tenant-scoped; cash receipts are joined by actual
  // receipt IDs, not by matching arbitrary activity names.
  const ids = penalties.map(p => p.id);
  const references = penalties.map(p => p.penaltyId);
  // Penalty.studentId stores the visible student number; Collection.studentId
  // stores the Student row UUID. Never match historical cash by display name.
  const studentPkByNumber = new Map(students.map(student => [student.studentId, student.id]));
  const studentPks = [...new Set(penalties.map(p => studentPkByNumber.get(p.studentId ?? ""))
    .filter((id): id is string => Boolean(id)))];
  const [events, receiptRows, olderArrears, serviceLogs, unlinkedReceiptRows] = await Promise.all([
    prisma.penaltySettlementEvent.findMany({
      where: { organizationId: organization.id, penaltyRecordId: { in: ids } },
      include: { receipt: { select: { orNumber: true, status: true, paymentType: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.collection.findMany({ where: {
      organizationId: organization.id,
      OR: references.map(reference => ({ itemDescription: { startsWith: `Penalty Fine [${reference}]:` } })),
    }, select: { id: true, itemDescription: true, orNumber: true, amountPaid: true,
      date: true, status: true, paymentType: true, academicYear: true, term: true },
    }),
    prisma.arrearPaymentLink.findMany({ where: {
      organizationId: organization.id, obligationType: "penalty", obligationId: { in: ids },
    }, include: { receipt: { select: { id: true, orNumber: true, amountPaid: true,
      date: true, status: true, paymentType: true, academicYear: true, term: true } } } }),
    prisma.systemLog.findMany({ where: { organizationId: organization.id,
      action: "SETTLE_PENALTY_SERVICE",
      OR: references.map(reference => ({ details: { contains: reference } })),
    }, orderBy: { timestamp: "asc" }, select: { id: true, timestamp: true, details: true, user: true } }),
    // Historical receipts such as "Penalty / Fines" do not carry a penalty ID.
    // Surface as UNLINKED evidence only, never as proof of a particular fine.
    prisma.collection.findMany({
      where: {
        organizationId: organization.id,
        academicYear: ay,
        term,
        studentId: { in: studentPks },
        penaltySettlementEvents: { none: {} },
        arrearPaymentLinks: { none: {} },
        OR: [
          { category: { contains: "penalty", mode: "insensitive" } },
          { itemDescription: { contains: "penalty", mode: "insensitive" } },
          { itemDescription: { contains: "fine", mode: "insensitive" } },
        ],
      },
      select: { id: true, studentId: true, date: true, orNumber: true,
        amountPaid: true, itemDescription: true, category: true,
        status: true, paymentType: true, academicYear: true, term: true },
      orderBy: [{ date: "desc" }, { id: "asc" }],
    }),
  ]);

  type HistoryEntry = {
    id: string; date: string; method: string; amount: number;
    minutesRendered: number; orNumber: string; accountingPeriod: string;
    recordedBy: string; note: string;
  };
  const historyByPenalty: Record<string, HistoryEntry[]> = {};
  // Only a structured CASH_PAYMENT replaces a legacy receipt entry.
  // A reversal alone must not hide the original historical receipt.
  const eventReceiptIds = new Set(events.filter(e => e.method === "CASH_PAYMENT")
    .map(e => e.receiptId).filter(Boolean));
  for (const penalty of penalties) {
    historyByPenalty[penalty.id] = [{
      id: `assessment-${penalty.id}`, date: new Date(penalty.date).toISOString(),
      method: "ASSESSMENT",
      amount: Number(penalty.assessedAmount ?? (Number(penalty.hoursLate) * Number(penalty.ratePerHour))),
      minutesRendered: 0, orNumber: "",
      accountingPeriod: `${penalty.term}, ${penalty.academicYear}`,
      recordedBy: penalty.encodedBy || "Officer",
      note: penalty.penaltyType === "LATE_FEE" ? "Late Fee — cash only" : "Community-service eligible assessment",
    }];
  }
  for (const event of events) {
    const rows = historyByPenalty[event.penaltyRecordId];
    if (!rows) continue;
    rows.push({ id: event.id, date: event.createdAt.toISOString(), method: event.method,
      amount: Number(event.amount), minutesRendered: event.minutesRendered,
      orNumber: event.receipt?.orNumber || "",
      accountingPeriod: `${event.accountingTerm}, ${event.accountingAY}`,
      recordedBy: event.recordedBy, note: event.note || "",
    });
  }
  for (const row of receiptRows) {
    if (eventReceiptIds.has(row.id)) continue;
    const match = row.itemDescription.match(/^Penalty Fine\s*\[([^\]]+)\]:/i);
    const penalty = penalties.find(p => p.penaltyId === match?.[1]);
    if (!penalty) continue;
    historyByPenalty[penalty.id].push({
      id: `legacy-receipt-${row.id}`, date: row.date.toISOString(),
      method: /VOID|CANCEL/i.test(`${row.status} ${row.paymentType}`) ? "LEGACY_VOID_RECEIPT" : "LEGACY_CASH",
      amount: Number(row.amountPaid), minutesRendered: 0,
      orNumber: row.orNumber, accountingPeriod: `${row.term}, ${row.academicYear}`,
      recordedBy: "Historical receipt", note: "Legacy receipt; check audit log for any void date",
    });
  }
  for (const link of olderArrears) {
    if (eventReceiptIds.has(link.receiptId) || !historyByPenalty[link.obligationId]) continue;
    historyByPenalty[link.obligationId].push({
      id: `legacy-arrear-${link.id}`, date: link.receipt.date.toISOString(),
      method: /VOID|CANCEL/i.test(`${link.receipt.status} ${link.receipt.paymentType}`)
        ? "LEGACY_VOID_RECEIPT" : "LEGACY_CASH",
      amount: Number(link.amount), minutesRendered: 0,
      orNumber: link.receipt.orNumber,
      accountingPeriod: `${link.receipt.term}, ${link.receipt.academicYear}`,
      recordedBy: "Historical arrears", note: "Linked historical receipt",
    });
  }
  for (const log of serviceLogs) {
    const match = (log.details || "").match(/^(PEN-[A-Fa-f0-9-]+):\s*(\d+) minutes rendered;.*?credit ₱([0-9,.]+)/);
    if (!match) continue;
    const penalty = penalties.find(p => p.penaltyId === match[1]);
    if (!penalty) continue;
    const credit = Number(match[3].replace(/,/g, ""));
    // New structured events already represent this legacy-text audit entry.
    const covered = events.some(e => e.penaltyRecordId === penalty.id &&
      e.method === "COMMUNITY_SERVICE" && Math.abs(Number(e.amount) - credit) < 0.005 &&
      Math.abs(e.createdAt.getTime() - log.timestamp.getTime()) < 120000);
    if (covered) continue;
    historyByPenalty[penalty.id].push({
      id: `legacy-service-${log.id}`, date: log.timestamp.toISOString(),
      method: "LEGACY_SERVICE", amount: credit,
      minutesRendered: Number(match[2]), orNumber: "",
      accountingPeriod: `${penalty.term}, ${penalty.academicYear}`,
      recordedBy: log.user, note: "Service credit from historical system audit log",
    });
  }
  for (const rows of Object.values(historyByPenalty)) rows.sort((a, b) => a.date.localeCompare(b.date));

  type UnlinkedReceipt = {
    id: string; date: string; orNumber: string; amount: number; description: string;
    category: string; status: string; paymentType: string; accountingPeriod: string;
  };
  // A machine-readable penaltyId in the receipt description is already
  // handled in historyByPenalty. Do not repeat it as an unlinked candidate.
  const explicitlyMatchedReceiptIds = new Set(receiptRows.map(row => row.id));
  const candidatesByStudentPk = new Map<string, UnlinkedReceipt[]>();
  for (const receipt of unlinkedReceiptRows) {
    if (!receipt.studentId || explicitlyMatchedReceiptIds.has(receipt.id)) continue;
    const list = candidatesByStudentPk.get(receipt.studentId) ?? [];
    list.push({
      id: receipt.id,
      date: receipt.date.toISOString(),
      orNumber: receipt.orNumber,
      amount: Number(receipt.amountPaid),
      description: receipt.itemDescription,
      category: receipt.category,
      status: receipt.status,
      paymentType: receipt.paymentType,
      accountingPeriod: `${receipt.term}, ${receipt.academicYear}`,
    });
    candidatesByStudentPk.set(receipt.studentId, list);
  }
  const unlinkedReceiptsByPenalty: Record<string, UnlinkedReceipt[]> = {};
  for (const penalty of penalties) {
    const studentPk = studentPkByNumber.get(penalty.studentId ?? "");
    // A receipt dated before the assessment cannot be evidence of paying it.
    // The same later receipt may still cover multiple older fines, so never
    // convert these suggestions into a penalty-specific settlement.
    const assessedAt = new Date(penalty.date).getTime();
    unlinkedReceiptsByPenalty[penalty.id] = studentPk
      ? (candidatesByStudentPk.get(studentPk) ?? []).filter(
          receipt => new Date(receipt.date).getTime() >= assessedAt
        )
      : [];
  }

  return (
    <div className="module card p-3 p-md-4 border-secondary shadow-sm">
      <h5 className="text-accent mb-2">
        <i className="bi bi-exclamation-octagon me-2" />Student Penalties Assessment
      </h5>
      <p className="text-secondary small mb-3">
        Choose Community-Service Eligible (cash or verified service) or Late Fee
        (flat cash-only amount). Outstanding fines place a clearance hold.
        Cash settlements must be posted using Collections and an official receipt.
      </p>
      <PenaltiesManager
        historyByPenalty={historyByPenalty}
        unlinkedReceiptsByPenalty={unlinkedReceiptsByPenalty}
        department={cleanDepartment}
        ay={ay}
        term={term}
        students={students}
        penalties={penalties.map(p => ({ ...p, assessedAmount: p.assessedAmount == null ? null : moneyNumber(p.assessedAmount), ratePerHour: moneyNumber(p.ratePerHour), fineAmount: moneyNumber(p.fineAmount) }))}
        canVoid={canVoid}
        canReconcile={canReconcile}
        periodClosed={periodClosed}
      />
    </div>
  );
}
