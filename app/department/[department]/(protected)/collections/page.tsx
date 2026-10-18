// /app/department/[department]/(protected)/collections/page.tsx

import { prisma } from "@/lib/prisma";
import { requireTabAccess } from "@/lib/permissions";
import CollectionsForm from "./CollectionsForm";
import { getPeriodLedger } from "../realign/ledger";
import { Metadata } from "next";
import { activeCollectibleDue, decodeStudentDue } from "../collectibles/due-link";
import { PENALTY_FUND_NAME } from "@/lib/penalty-fund";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Centralized Liquidation of Expenses & Audit Records",
};

export default async function CollectionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ department: string }>;
  searchParams?: Promise<{
    ay?: string;
    term?: string;
    prefillId?: string;
    penaltyId?: string;
    prefillCategory?: string;
    prefillDesc?: string;
    prefillAmount?: string;
    collectibleId?: string;
  }>;
}) {
  const { department } = await params;
  const cleanDepartment = decodeURIComponent(department).toLowerCase().trim();

  // 🚀 SECURITY FIX: Enforce tab-level permissions for collections access
  await requireTabAccess('tab-payment', cleanDepartment);

  const resolvedSearch = searchParams ? await searchParams : {};
  const prefillId = resolvedSearch.prefillId || "";
  const penaltyId = resolvedSearch.penaltyId || "";
  const prefillCategory = resolvedSearch.prefillCategory || "";
  const prefillDesc = resolvedSearch.prefillDesc || "";
  const prefillAmount = resolvedSearch.prefillAmount || "";
  const collectibleId = resolvedSearch.collectibleId || "";

  const organization = await prisma.organization.findUnique({
    where: { subdomain: cleanDepartment },
    select: {
      id: true,
      name: true,
      activeAy: true,
      activeTerm: true,
    }
  });

  if (!organization) {
    return (
      <div className="alert alert-danger p-4 shadow-sm border-secondary">
        <h4 className="fw-bold mb-2">Department Not Found</h4>
        <p className="small mb-0">The department '{decodeURIComponent(department)}' does not exist.</p>
      </div>
    );
  }

  // 🚀 Dynamically link academic year and term to organization database defaults
  const ay = resolvedSearch.ay || organization.activeAy || "A.Y. 2026 - 2027";
  const term = resolvedSearch.term || organization.activeTerm || "1st Sem";

  const ledger = await getPeriodLedger(prisma, organization.id, ay, term);

  const students = await prisma.student.findMany({
    where: { organizationId: organization.id },
    select: { studentId: true, fullName: true, email: true },
    orderBy: { fullName: "asc" },
  });

  const funds = await prisma.fund.findMany({
    where: { organizationId: organization.id, academicYear: ay, term },
    orderBy: { fundName: "asc" },
  });

  const collectionSetups = await prisma.collectionSetup.findMany({
    where: { organizationId: organization.id, academicYear: ay, term },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  // Payment links from Receivables identify the EXACT assessed collectible.
  // Resolve the student, fee, outstanding amount, and destination fund from
  // tenant-scoped database records instead of trusting URL values.
  const collectible = collectibleId
    ? await prisma.collectible.findFirst({
        where: {
          id: collectibleId,
          organizationId: organization.id,
          academicYear: ay,
          term,
        },
        select: { id: true, category: true, status: true, balanceDue: true },
      })
    : null;

  const linkedDueIdentity = collectible ? decodeStudentDue(collectible.status) : null;
  const linkedFee = collectible && linkedDueIdentity && activeCollectibleDue(collectible)
    ? collectionSetups.find((fee) =>
        fee.isPackage === false &&
        fee.category.trim().toLowerCase() === collectible.category.trim().toLowerCase() &&
        fee.name.trim().toLowerCase() === linkedDueIdentity.itemDescription.trim().toLowerCase()
      )
    : undefined;

  const linkedCollectible = collectible && linkedDueIdentity && linkedFee &&
    funds.some((fund) => fund.fundName === linkedFee.targetFund)
    ? {
        studentId: linkedDueIdentity.studentId,
        category: linkedFee.category,
        description: linkedFee.name,
        balanceDue: collectible.balanceDue,
        fund: linkedFee.targetFund,
      }
    : null;

  // Penalty payment details must come from the database, not query-string
  // amount/name/category. The form is blocked for voided or settled records.
  const linkedPenalty = penaltyId ? await prisma.penalty.findFirst({
    where: { organizationId: organization.id, penaltyId, academicYear: ay, term },
    select: { penaltyId: true, studentId: true, activity: true, fineAmount: true,
      ratePerHour: true, hoursLate: true, status: true },
  }) : null;

  const recentReceipts = await prisma.collection.findMany({
    where: { organizationId: organization.id, academicYear: ay },
    select: { orNumber: true },
  });

  const match = ay.match(/\d{4}/);
  const yearPrefix = match ? match[0].slice(-2) : "26";
  let nextOr = `${yearPrefix}-001`;

  const issuedNumbers = recentReceipts.map(c => String(c.orNumber || ""));
  const maxNum = issuedNumbers.reduce((max, value) => {
    const match = value.match(new RegExp(`^${yearPrefix}-(\\d+)(?:-P\\d+)?$`, 'i'));
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  const candidate = maxNum + 1;
  nextOr = `${yearPrefix}-${String(candidate).padStart(3, "0")}`;

  return (
    <div className="module card p-3 p-md-4 border-secondary shadow-sm">
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
        <h5 className="text-accent mb-0"><i className="bi bi-cash-stack me-2" />Collection Remittance</h5>
        <Link className="btn btn-outline-info btn-sm" href={`/department/${encodeURIComponent(cleanDepartment)}/collections/arrears`}>
          <i className="bi bi-clock-history me-1" />Receive Previous-Term Arrears
        </Link>
      </div>
      {collectionSetups.length === 0 && <div className="alert alert-info d-flex flex-wrap justify-content-between align-items-center gap-2" role="status">
        <span>No collection fees are configured for <strong>{term} ({ay})</strong>. An authorized officer can add items in Fee Setup.</span>
        <Link className="btn btn-outline-info btn-sm fw-bold" href={`/department/${encodeURIComponent(cleanDepartment)}/setup/collections?ay=${encodeURIComponent(ay)}&term=${encodeURIComponent(term)}`}>
          <i className="bi bi-plus-circle me-1" />Open Collection Fee Setup
        </Link>
      </div>}
      {collectibleId && !linkedCollectible && (
        <div className="alert alert-warning" role="alert">
          This collectible is no longer payable, or its configured standalone fee or destination fund is missing
          for the selected academic term. Return to Collectibles, review Fee Setup, and refresh before posting a payment.
        </div>
      )}
      {collectibleId && linkedCollectible && (
        <div className="alert alert-info py-2 small" role="status">
          Paying assessed collectible <strong>{linkedCollectible.description}</strong>. Destination fund:
          <strong> {linkedCollectible.fund}</strong>. The receipt will be posted against this configured fund.
        </div>
      )}
      {penaltyId && !linkedPenalty && (
        <div className="alert alert-danger">Penalty not found for this department and term. Return to Penalty Logs.</div>
      )}
      {linkedPenalty && (
        <div className="alert alert-info py-2 small" role="status">
          Cash penalty receipts are always deposited in <strong>{PENALTY_FUND_NAME}</strong>
          for this department and accounting period. Prior receipts keep their original allocations.
        </div>
      )}
      {(!penaltyId || linkedPenalty) && (!collectibleId || linkedCollectible) && <CollectionsForm
        department={cleanDepartment}
        ay={ay}
        term={term}
        students={students}
        funds={funds}
        collectionItems={collectionSetups}
        nextOr={nextOr}
        prefillId={linkedCollectible ? linkedCollectible.studentId : linkedPenalty ? (linkedPenalty.studentId || "") : prefillId}
        penaltyId={penaltyId}
        prefillCategory={linkedCollectible ? linkedCollectible.category : linkedPenalty ? "Others" : prefillCategory}
        prefillDesc={linkedCollectible ? linkedCollectible.description : linkedPenalty ? `Penalty Fine: ${linkedPenalty.activity}` : prefillDesc}
        prefillAmount={linkedCollectible ? String(linkedCollectible.balanceDue) : linkedPenalty ? String(linkedPenalty.fineAmount) : prefillAmount}
        prefillFund={linkedPenalty ? PENALTY_FUND_NAME : linkedCollectible ? linkedCollectible.fund : undefined}
        penaltyState={linkedPenalty ? {
          balance: linkedPenalty.fineAmount,
          ratePerHour: linkedPenalty.ratePerHour,
          originalHours: linkedPenalty.hoursLate,
          status: linkedPenalty.status,
        } : undefined}
        closed={Boolean(ledger.activeRollover)}
      />}
    </div>
  );
}