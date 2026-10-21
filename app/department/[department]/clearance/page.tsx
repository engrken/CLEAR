// /app/department/[department]/clearance/page.tsx

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { fmt, money } from '@/lib/utils';
import { requireTabAccess } from '@/lib/permissions';
import { formatInTimeZone } from 'date-fns-tz';
import { headers } from 'next/headers';
import crypto from 'node:crypto';
import Link from 'next/link';
import Image from 'next/image';
import ClearanceClientView from './ClearanceClientView';
import StudentClearanceInquiry from './StudentClearanceInquiry';
import ClearanceManager from './ClearanceManager';
import DataPrivacyModal from '../components/DataPrivacyModal';
import { Metadata } from 'next';
import { decodeStudentDue, activeCollectibleDue } from '../(protected)/collectibles/due-link';
import { getPeriodLedger } from '../(protected)/realign/ledger';
import { listHistoricalDebts, type HistoricalDebt } from '@/lib/student-arrears';
import { isOutstandingPenalty } from '@/lib/penalty-clearance-status';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Centralized Liquidation of Expense & Audit Records',
};

function formatOrgDisplayName(organizationName: string) {
  const lower = String(organizationName || '').trim().toLowerCase();
  if (!lower) return 'Department Portal';
  if (
    lower.startsWith('college') ||
    lower.includes('department') ||
    lower.includes('institute') ||
    lower.includes('school')
  ) {
    return organizationName;
  }
  return organizationName;
}

function getClearanceSecret(): string {
  const secret =
    process.env.CLEARANCE_SALT ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error(
      'Server configuration error: CLEARANCE_SALT or AUTH_SECRET environment variable is required.'
    );
  }
  return secret;
}

function generateClearanceSignature(orgId: string, studentId: string, ay: string, term: string): string {
  const secret = getClearanceSecret();
  const payload = `CLEAR-V2|${orgId}|${studentId.trim().toLowerCase()}|${ay.trim()}|${term.trim()}`;
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

function verifyClearanceSignature(
  orgId: string,
  studentId: string,
  ay: string,
  term: string,
  providedSig: string
): boolean {
  try {
    const expectedSig = generateClearanceSignature(orgId, studentId, ay, term);
    const a = Buffer.from(expectedSig.toLowerCase(), 'utf8');
    const b = Buffer.from(String(providedSig || '').trim().toLowerCase(), 'utf8');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

async function checkOfficerClearanceAccess(department: string): Promise<boolean> {
  try {
    await requireTabAccess('tab-clearance', department);
    return true;
  } catch {
    return false;
  }
}

function isVoidedCollection(c: { paymentType?: unknown; status?: unknown }) {
  const pt = String(c.paymentType || '').toUpperCase();
  const st = String(c.status || '').toUpperCase();
  return pt.includes('VOID') || st.includes('VOID') || st.includes('CANCEL');
}

function buildTermPackage(collectionSetups: any[], _term: string) {
  // The official package is defined exclusively by this organization's setup.
  // Never silently introduce FCU-specific default fees for an unrelated tenant.
  const pkgItems = collectionSetups.filter(c => c.isPackage === true);
  return {
    total: money(pkgItems.reduce((sum: number, c: any) => sum + Number(c.amount || 0), 0)),
    items: pkgItems.map((c: any) => ({
      name: String(c.name || "").trim(),
      rate: money(c.amount),
      fund: String(c.targetFund || "").trim(),
    })),
  };
}

const PublicHeader = ({ organizationName }: { organizationName: string }) => {
  const displayOrgName = formatOrgDisplayName(organizationName);
  return (
    <header className="navbar border-bottom border-secondary px-4 py-3 bg-body shadow-sm d-print-none text-body">
      <div className="d-flex align-items-center gap-3 w-100">
        <img src="/clearsys.png" alt="clearsys Logo" style={{ width: '55px', objectFit: 'contain' }} />
        <div>
          <h5 className="mb-0 fw-bold text-info">CLEAR System</h5>
          <small className="text-muted text-uppercase fw-semibold" style={{ letterSpacing: '0.05em' }}>
            {displayOrgName}
          </small>
        </div>
      </div>
    </header>
  );
};

export default async function ClearancePage({
  params,
  searchParams,
}: {
  params: Promise<{ department: string }>;
  searchParams?: Promise<{
    ay?: string;
    term?: string;
    q?: string;
    sig?: string;
  }>;
}) {
  const { department } = await params;
  const resolvedSearch = searchParams ? await searchParams : {};

  const cleanDepartment = decodeURIComponent(department).toLowerCase().trim();
  const basePath = `/department/${encodeURIComponent(cleanDepartment)}`;

  const headersList = await headers();
  const rawHost = headersList.get('host') || 'localhost:3000';
  const host = /^[a-z0-9.:-]+$/i.test(rawHost) ? rawHost : 'localhost:3000';
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
  const absoluteBaseUrl = `${protocol}://${host}`;

  const organization = await prisma.organization.findUnique({
    where: { subdomain: cleanDepartment },
  });

  if (!organization) {
    return (
      <div className="d-flex flex-column min-vh-100 bg-body-tertiary">
        <main className="flex-grow-1 p-4 d-flex align-items-center justify-content-center">
          <div className="alert alert-danger p-4 shadow-sm border-secondary text-center">
            <h4 className="fw-bold mb-2">Department Not Found</h4>
            <p className="small mb-0">The department '{decodeURIComponent(department)}' does not exist.</p>
          </div>
        </main>
      </div>
    );
  }

  const ay = resolvedSearch.ay || organization.activeAy || 'A.Y. 2026 - 2027';
  const term = resolvedSearch.term || organization.activeTerm || '1st Sem';
  const q = resolvedSearch.q?.trim();
  const sigParam = resolvedSearch.sig?.trim();
  const queryString = `?ay=${encodeURIComponent(ay)}&term=${encodeURIComponent(term)}`;

  // 🚀 SECURITY FIX (F31): Verify both session AND tenant/tab authorization before granting Officer view
  const session = await auth();
  const hasSession = Boolean(session?.user);
  const isOfficer = hasSession ? await checkOfficerClearanceAccess(cleanDepartment) : false;

  // Opt-in privacy cutover, OFF by default. A school ID/email in an anonymous
  // URL is not identity proof; never read or render a student's private status.
  // Signed third-party certificate verification (?q=...&sig=...) is separate
  // and deliberately preserved pending a reviewed certificate policy.
  if (!isOfficer && !sigParam && process.env.CLEAR_PUBLIC_CLEARANCE_REQUIRE_OTP === 'true') {
    return (
      <div className="d-flex flex-column min-vh-100 bg-body-tertiary text-body">
        {!hasSession && <PublicHeader organizationName={organization.name} />}
        <main className="flex-grow-1 p-3 p-md-5 mx-auto w-100" style={{ maxWidth: '760px' }}>
          <StudentClearanceInquiry
            department={cleanDepartment}
            organizationName={organization.name}
            academicYear={organization.activeAy}
            term={organization.activeTerm}
          />
        </main>
      </div>
    );
  }


  // 🚀 SECURITY FIX (F30): Compute termPkg directly from collectionSetup without invoking internal treasury engine
  const collectionSetups = await prisma.collectionSetup.findMany({
    where: { organizationId: organization.id, academicYear: ay, term },
    orderBy: { name: 'asc' },
  });

  const termPkg = buildTermPackage(collectionSetups, term);

  const periodLedger = await getPeriodLedger(prisma, organization.id, ay, term);
  const isClosed = Boolean(periodLedger.activeRollover);
  // Historic debts are assessed records, not inferred fees for all prior years.
  const historicalDebts = await listHistoricalDebts(prisma, organization.id, ay, term);
  const historicalByStudent = new Map<string, HistoricalDebt[]>();
  for (const debt of historicalDebts) {
    const key = debt.studentId.trim().toLowerCase();
    historicalByStudent.set(key, [...(historicalByStudent.get(key) || []), debt]);
  }

  // Public proof options are derived from the real Fee Setup, not an
  // invented 'Other' fee. Package options are explicitly scoped by category.
  const packageRates = new Map<string, number>();
  for (const setup of collectionSetups) {
    if (!setup.isPackage || !Number.isFinite(Number(setup.amount)) || Number(setup.amount) <= 0) continue;
    packageRates.set(setup.category, (packageRates.get(setup.category) || 0) + money(setup.amount));
  }
  const feeOptions = [
    ...Array.from(packageRates, ([category, amount]) => ({
      category, name: 'Departmental Fee (Full Package)', amount,
    })),
    ...collectionSetups.filter(c => Number(c.amount) > 0).map(c => ({
      category: c.category, name: c.name, amount: money(c.amount),
    })),
  ];

  // Helper to evaluate a single student's live obligations
  const evaluateStudentObligations = (
    student: { id: string; studentId: string; fullName: string },
    collections: any[],
    penalties: any[],
    advances: any[],
    collectibles: any[] = []
  ) => {
    const unpaidItems: { category: string; itemDescription: string; balanceDue: number }[] = [];
    const studentDbIdKey = String(student.id || '').trim().toLowerCase();
    const studentNumKey = String(student.studentId || '').trim().toLowerCase();
    const studentNameKey = String(student.fullName || '').trim().toLowerCase();

    const validCols = collections.filter((c) => !isVoidedCollection(c));

    // 🚀 FIX (F50): Match collections by Student CUID (`student.id`), Student ID Number (`student.studentId`), or Full Name
    const myCollections = validCols.filter((c) => {
      const cStudentId = String(c.studentId || '').trim().toLowerCase();
      const cStudentName = String(c.studentName || '').trim().toLowerCase();
      return (
        (cStudentId && (cStudentId === studentDbIdKey || cStudentId === studentNumKey)) ||
        (cStudentName && cStudentName === studentNameKey)
      );
    });

    const isPackageCollection = (desc: string) => {
      const descLower = desc.toLowerCase();
      return (
        termPkg.items.some((pi: any) => String(pi.name).trim().toLowerCase() === descLower) ||
        descLower.includes('package') ||
        descLower === 'departmental fee'
      );
    };

    const packagePaid = money(
      myCollections
        .filter((c) => isPackageCollection(String(c.itemDescription || '')))
        .reduce((sum, c) => sum + (Number(c.amountPaid) || 0), 0)
    );

    const remainingPkg = money(termPkg.total - packagePaid);
    if (termPkg.total > 0 && remainingPkg > 0) {
      unpaidItems.push({
        category: 'Departmental Fee',
        itemDescription: 'Mandatory Package Balance',
        balanceDue: remainingPkg,
      });
    }

    // Group standalone items accurately by itemDescription
    const standaloneGroups = new Map<
      string,
      { category: string; assessed: number; paid: number; hasDue: boolean }
    >();
    for (const c of myCollections) {
      const desc = String(c.itemDescription || '').trim();
      if (!desc || isPackageCollection(desc) || /^Historical (Penalty|Collectible) \[/i.test(desc)) continue;
      const key = desc.toLowerCase();
      const group = standaloneGroups.get(key) || {
        category: String(c.category || 'Assessment'),
        assessed: 0,
        paid: 0,
        hasDue: false,
      };
      group.assessed = Math.max(group.assessed, money(c.standardRate));
      group.paid = money(group.paid + money(c.amountPaid));
      if (money(c.balanceDue) > 0) group.hasDue = true;
      standaloneGroups.set(key, group);
    }

    standaloneGroups.forEach((group, key) => {
      const rem = money(group.assessed - group.paid);
      if (rem > 0) {
        const displayDesc =
          myCollections.find(
            (c) => String(c.itemDescription || '').trim().toLowerCase() === key
          )?.itemDescription || key;
        unpaidItems.push({
          category: group.category,
          itemDescription: displayDesc,
          balanceDue: rem,
        });
      }
    });

    const myPenalties = penalties.filter((p) => {
      const pSid = String(p.studentId || '').trim().toLowerCase();
      return (
        (pSid === studentNumKey || pSid === studentDbIdKey) &&
        isOutstandingPenalty(p)
      );
    });

    if (myPenalties.length > 0) {
      const totalPen = money(
        myPenalties.reduce((sum, p) => sum + (Number(p.fineAmount) || 0), 0)
      );
      if (totalPen > 0) {
        unpaidItems.push({
          category: 'Penalty',
          itemDescription: 'Unsettled Fine / Arrears',
          balanceDue: totalPen,
        });
      }
    }

    const myAdvances = advances.filter((ca) => {
      const req = String(ca.requestor || '').toLowerCase();
      const st = String(ca.status || '').toUpperCase();
      return (
        studentNumKey &&
        req.includes(studentNumKey) &&
        (st.includes('PENDING') || st.includes('UNLIQUIDATED')) &&
        !st.includes('CANCEL') &&
        !st.includes('VOID') &&
        !st.includes('LIQUIDATED')
      );
    });

    if (myAdvances.length > 0) {
      myAdvances.forEach((ca) =>
        unpaidItems.push({
          category: 'Cash Advance',
          itemDescription: `Unliquidated CA [${ca.advanceId}]`,
          balanceDue: money(ca.amountApproved),
        })
      );
    }

    const myCollectibles = collectibles.filter((due) => {
      if (!activeCollectibleDue(due)) return false;
      const marker = decodeStudentDue(due.status);
      return marker && marker.studentId.toLowerCase() === studentNumKey;
    });
    for (const due of myCollectibles) {
      const marker = decodeStudentDue(due.status);
      if (!marker) continue;
      // Replace duplicate item-level remainder derived from prior installment rows
      // with the linked collectible's authoritative unpaid balance.
      const existing = unpaidItems.findIndex((u) =>
        u.itemDescription.trim().toLowerCase() === marker.itemDescription.trim().toLowerCase());
      if (existing >= 0) unpaidItems.splice(existing, 1);
      unpaidItems.push({
        category: String(due.category || 'Collectible'),
        itemDescription: marker.itemDescription,
        balanceDue: money(due.balanceDue),
      });
    }
    // Historic penalty/collectible obligations survive rollover and academic-year changes.
    // Display originating period for officers; public view still reveals status only.
    for (const debt of historicalByStudent.get(studentNumKey) || []) {
      unpaidItems.push({
        category: `${debt.category} — Previous Period`,
        itemDescription: `${debt.itemDescription} (${debt.originTerm}, ${debt.originAY})`,
        balanceDue: money(debt.balanceDue),
      });
    }
    return unpaidItems;
  };

  // =========================================================================
  // 1. DIGITAL QR SIGNATURE VERIFICATION VIEW
  // =========================================================================
  if (sigParam && q) {
    const isCryptoValid = verifyClearanceSignature(organization.id, q, ay, term, sigParam);
    let isLiveCleared = false;
    let verifiedStudent: any = null;
    let liveUnpaid: { category: string; itemDescription: string; balanceDue: number }[] = [];

    if (isCryptoValid) {
      // 🚀 SECURITY FIX (F49): Verify live database status so revoked/voided clearances cannot pass verification
      verifiedStudent = await prisma.student.findFirst({
        where: {
          organizationId: organization.id,
          studentId: { equals: q, mode: 'insensitive' },
        },
      });

      if (verifiedStudent) {
        const [studentCols, studentPens, studentAdvs, studentDues] = await Promise.all([
          prisma.collection.findMany({
            where: {
              organizationId: organization.id,
              academicYear: ay,
              term,
              OR: [
                { studentId: verifiedStudent.id },
                { studentId: { equals: verifiedStudent.studentId, mode: 'insensitive' } },
                { studentName: { equals: verifiedStudent.fullName, mode: 'insensitive' } },
              ],
            },
          }),
          prisma.penalty.findMany({
            where: {
              organizationId: organization.id,
              academicYear: ay,
              term,
              studentId: { equals: verifiedStudent.studentId, mode: 'insensitive' },
            },
          }),
          prisma.cashAdvance.findMany({
            where: {
              organizationId: organization.id,
              academicYear: ay,
              term,
              requestor: { contains: verifiedStudent.studentId, mode: 'insensitive' },
            },
          }),
          prisma.collectible.findMany({ where: { organizationId: organization.id, academicYear: ay, term } }),
        ]);

        liveUnpaid = evaluateStudentObligations(
          verifiedStudent,
          studentCols,
          studentPens,
          studentAdvs,
          studentDues
        );
        isLiveCleared = liveUnpaid.length === 0;
      }
    }

    const isSignatureValid = isCryptoValid && isLiveCleared;
    const displayOrgName = formatOrgDisplayName(organization.name);

    return (
      <div className="d-flex flex-column min-vh-100 bg-body-tertiary text-body">
        {!hasSession && <PublicHeader organizationName={organization.name} />}
        <main className="flex-grow-1 p-3 p-md-5 w-100 d-flex align-items-center justify-content-center">
          <div className="card p-4 border-secondary text-center shadow-lg w-100 bg-body text-body" style={{ maxWidth: '550px' }}>
            <h4 className="text-info fw-bold mb-1">{displayOrgName}</h4>
            <small className="text-muted d-block mb-4">Centralized Liquidation of Expenses & Audit Records</small>

            {isSignatureValid ? (
              <>
                <div className="bg-success text-white p-3 rounded fw-bold fs-5 mb-4 shadow-sm">
                  <i className="bi bi-check-circle-fill me-2"></i>OFFICIAL CLEARANCE VALID
                </div>
                <table className="table table-sm table-borderless text-start text-body mb-4">
                  <tbody>
                    <tr className="border-bottom border-secondary">
                      <td className="text-muted py-2">Student ID:</td>
                      <td className="fw-bold text-info py-2">{verifiedStudent?.studentId || q}</td>
                    </tr>
                    {isOfficer && verifiedStudent?.fullName && (
                      <tr className="border-bottom border-secondary">
                        <td className="text-muted py-2">Student Name:</td>
                        <td className="fw-bold py-2">{verifiedStudent.fullName}</td>
                      </tr>
                    )}
                    <tr className="border-bottom border-secondary">
                      <td className="text-muted py-2">Academic Term:</td>
                      <td className="py-2">{term} ({ay})</td>
                    </tr>
                    <tr className="border-bottom border-secondary">
                      <td className="text-muted py-2">Verification Time:</td>
                      <td className="py-2">{formatInTimeZone(new Date(), 'Asia/Manila', 'MMM dd, yyyy - hh:mm a')}</td>
                    </tr>
                    <tr>
                      <td className="text-muted py-2">Crypto Hash:</td>
                      <td className="font-monospace text-muted small py-2">{sigParam.substring(0, 16)}...</td>
                    </tr>
                  </tbody>
                </table>
                <p className="text-success small fw-semibold m-0">
                  This certificate confirms no unpaid financial obligations for this student, including recorded previous-period arrears, at the verification time.
                </p>
              </>
            ) : (
              <div className="bg-danger text-white p-3 rounded fw-bold fs-5 mb-3 shadow-sm">
                <i className="bi bi-x-circle-fill me-2"></i>INVALID OR ON HOLD
                <p className="fs-6 fw-normal m-0 mt-2">
                  This clearance token is either invalid or active financial obligations were logged after issuance.
                </p>
                {/* Show itemized breakdown ONLY to authenticated officers */}
                {isOfficer && liveUnpaid.length > 0 && (
                  <div className="mt-3 p-3 bg-body text-body rounded text-start">
                    <h6 className="text-danger fw-bold small text-uppercase mb-2">
                      Officer View — Itemized Hold Breakdown:
                    </h6>
                    <ul className="list-group list-group-flush small">
                      {liveUnpaid.map((item, idx) => (
                        <li key={idx} className="list-group-item bg-transparent d-flex justify-content-between px-0 py-1">
                          <span><strong>{item.category}:</strong> {item.itemDescription}</span>
                          <span className="text-danger fw-bold">{fmt(item.balanceDue)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
        {!hasSession && <DataPrivacyModal />}
      </div>
    );
  }

  // =========================================================================
  // 2. OFFICER CLEARANCE DASHBOARD VIEW (SHOWS FULL ITEMIZED BREAKDOWN)
  // =========================================================================
  if (isOfficer && !sigParam) {
    const [allStudents, allCollections, allPenalties, allAdvances, allDues] = await Promise.all([
      prisma.student.findMany({ where: { organizationId: organization.id }, orderBy: { fullName: 'asc' } }),
      prisma.collection.findMany({ where: { organizationId: organization.id, academicYear: ay, term } }),
      prisma.penalty.findMany({ where: { organizationId: organization.id, academicYear: ay, term } }),
      prisma.cashAdvance.findMany({ where: { organizationId: organization.id, academicYear: ay, term } }),
      prisma.collectible.findMany({ where: { organizationId: organization.id, academicYear: ay, term } }),
    ]);

    const clearanceRoster = allStudents.map((student) => {
      const unpaidItems = evaluateStudentObligations(
        student,
        allCollections,
        allPenalties,
        allAdvances,
        allDues
      );

      return {
        studentId: student.studentId,
        fullName: student.fullName,
        email: student.email,
        isCleared: unpaidItems.length === 0,
        unpaidItems,
      };
    });

    // If officer also passed a direct `?q=...` query, find that student in the roster to highlight their itemized balance immediately
    const queriedStudent = q
      ? clearanceRoster.find(
          (s) =>
            s.studentId.toLowerCase() === q.toLowerCase() ||
            (s.email && s.email.toLowerCase() === q.toLowerCase()) ||
            s.fullName.toLowerCase().includes(q.toLowerCase())
        )
      : null;

    const queriedClearanceSig =
      queriedStudent && queriedStudent.isCleared
        ? generateClearanceSignature(organization.id, queriedStudent.studentId, ay, term)
        : '';
    const queriedVerifyUrl =
      queriedStudent && queriedStudent.isCleared
        ? `${absoluteBaseUrl}${basePath}/clearance?ay=${encodeURIComponent(ay)}&term=${encodeURIComponent(term)}&q=${encodeURIComponent(queriedStudent.studentId)}&sig=${encodeURIComponent(queriedClearanceSig)}`
        : '';

    return (
      <div className="d-flex flex-column min-vh-100 bg-body-tertiary">
        <main className="flex-grow-1 p-3 p-md-5 mx-auto w-100" style={{ maxWidth: '1200px' }}>
          <div className="module card p-3 p-md-4 border-secondary shadow-sm h-100 bg-body text-body">
            <h5 className="text-info mb-3 fw-bold">
              <i className="bi bi-shield-check me-2"></i> Officer Clearance Dashboard
            </h5>

            {q && queriedStudent && (
              <div className="card p-3 border-info shadow-sm mb-4 bg-body-secondary">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <div>
                    <span className="badge bg-info text-dark me-2">OFFICER LOOKUP</span>
                    <strong className="text-info fs-5">{queriedStudent.fullName}</strong>{' '}
                    <span className="text-muted">({queriedStudent.studentId})</span>
                  </div>
                  <div className="d-flex flex-wrap gap-2">
                    {!queriedStudent.isCleared && <Link href={`${basePath}/collections/arrears?studentId=${encodeURIComponent(queriedStudent.studentId)}&ay=${encodeURIComponent(organization.activeAy || ay)}&term=${encodeURIComponent(organization.activeTerm || term)}`}
                      className="btn btn-sm btn-outline-info">Pay Previous-Period Arrears</Link>}
                    <Link href={`${basePath}/clearance${queryString}`} className="btn btn-sm btn-outline-secondary">Clear Filter</Link>
                  </div>
                </div>

                {queriedStudent.isCleared ? (
                  <div className="alert border-success bg-success bg-opacity-10 text-success py-3 mb-0 text-center">
                    <div className="fw-bold mb-2">
                      <i className="bi bi-patch-check-fill me-2"></i> CLEARED FOR SIGNING
                    </div>
                    <div className="d-inline-block p-2 bg-white rounded border border-success shadow-sm mb-2">
                      <Image
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(queriedVerifyUrl)}`}
                        alt="Clearance QR Code"
                        width={120}
                        height={120}
                        unoptimized
                      />
                    </div>
                    <div>
                      <a href={queriedVerifyUrl} target="_blank" rel="noopener noreferrer" className="btn btn-success btn-sm fw-bold text-dark">
                        <i className="bi bi-box-arrow-up-right me-1"></i> Open Digital Certificate
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2">
                    <h6 className="text-danger fw-bold small text-uppercase mb-2">
                      <i className="bi bi-exclamation-triangle-fill me-1"></i> Clearance On Hold — Itemized Balance Breakdown:
                    </h6>
                    <div className="table-responsive">
                      <table className="table table-sm table-bordered border-secondary mb-0 bg-body text-body">
                        <thead className="table-dark">
                          <tr>
                            <th>Category</th>
                            <th>Obligation / Item Description</th>
                            <th className="text-end">Balance Due</th>
                          </tr>
                        </thead>
                        <tbody>
                          {queriedStudent.unpaidItems.map((item, i) => (
                            <tr key={i}>
                              <td><span className="badge bg-secondary">{item.category}</span></td>
                              <td>{item.itemDescription}</td>
                              <td className="text-end text-danger fw-bold">{fmt(item.balanceDue)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="fw-bold">
                            <td colSpan={2} className="text-end">Total Arrears:</td>
                            <td className="text-end text-danger">
                              {fmt(queriedStudent.unpaidItems.reduce((s, x) => s + x.balanceDue, 0))}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            <ClearanceManager
              department={cleanDepartment}
              ay={ay}
              term={term}
              students={clearanceRoster}
              feeOptions={feeOptions}
              packageRate={termPkg.total}
              closed={isClosed}
            />
          </div>
        </main>
      </div>
    );
  }

  // =========================================================================
  // 3. PUBLIC STUDENT SELF-VERIFICATION PORTAL (STATUS + QR ONLY; NO ITEMIZED DETAILS)
  // =========================================================================
  let studentRecord = null;
  let isCleared = false;
  let clearanceSig = '';
  let verifyUrl = '';

  if (q && !isOfficer) {
    studentRecord = await prisma.student.findFirst({
      where: {
        organizationId: organization.id,
        OR: [
          { studentId: { equals: q, mode: 'insensitive' } },
          { email: { equals: q, mode: 'insensitive' } },
        ],
      },
    });

    if (studentRecord) {
      const [collections, penalties, cashAdvances, studentDues] = await Promise.all([
        prisma.collection.findMany({
          where: {
            organizationId: organization.id,
            academicYear: ay,
            term,
            OR: [
              { studentId: studentRecord.id },
              { studentId: { equals: studentRecord.studentId, mode: 'insensitive' } },
              { studentName: { equals: studentRecord.fullName, mode: 'insensitive' } },
            ],
          },
        }),
        prisma.penalty.findMany({
          where: {
            organizationId: organization.id,
            academicYear: ay,
            term,
            studentId: { equals: studentRecord.studentId, mode: 'insensitive' },
          },
        }),
        prisma.cashAdvance.findMany({
          where: {
            organizationId: organization.id,
            academicYear: ay,
            term,
            requestor: { contains: studentRecord.studentId, mode: 'insensitive' },
          },
        }),
        prisma.collectible.findMany({ where: { organizationId: organization.id, academicYear: ay, term } }),
      ]);

      const unpaidItems = evaluateStudentObligations(
        studentRecord,
        collections,
        penalties,
        cashAdvances,
        studentDues
      );

      isCleared = unpaidItems.length === 0;

      if (isCleared) {
        clearanceSig = generateClearanceSignature(organization.id, studentRecord.studentId, ay, term);
        verifyUrl = `${absoluteBaseUrl}${basePath}/clearance?ay=${encodeURIComponent(ay)}&term=${encodeURIComponent(term)}&q=${encodeURIComponent(studentRecord.studentId)}&sig=${encodeURIComponent(clearanceSig)}`;
      }
    }
  }

  return (
    <div className="d-flex flex-column min-vh-100 bg-body-tertiary">
      {!hasSession && <PublicHeader organizationName={organization.name} />}
      <main className="flex-grow-1 p-3 p-md-5 mx-auto w-100 text-body" style={{ maxWidth: '1200px' }}>
        <div className="module card p-3 p-md-4 border-secondary shadow-sm h-100 bg-body">
          <h5 className="text-info mb-2 fw-bold">
            <i className="bi bi-person-check me-2"></i>Student Financial Clearance Verification
          </h5>
          <p className="text-muted small mb-3">
            Verification requires your exact <strong>Student ID</strong> or registered <strong>Email Address</strong>.
          </p>

          <form method="GET" action={`${basePath}/clearance`} className="mb-4">
            <input type="hidden" name="ay" value={ay} />
            <input type="hidden" name="term" value={term} />
            <div className="row g-2">
              <div className="col-12 col-md-8">
                <div className="input-group">
                  <span className="input-group-text border-secondary text-muted bg-body-secondary">
                    <i className="bi bi-person-vcard"></i>
                  </span>
                  <input
                    type="text"
                    name="q"
                    className="form-control bg-body text-body border-secondary"
                    placeholder="Enter student ID or registered email..."
                    defaultValue={q || ''}
                    autoComplete="off"
                    required
                  />
                </div>
              </div>
              <div className="col-12 col-md-4 d-flex align-items-end">
                <button type="submit" className="btn btn-info text-dark w-100 fw-bold">
                  <i className="bi bi-search me-1"></i> Check Clearance
                </button>
              </div>
            </div>
          </form>

          {q && (
            <div className="modal fade show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}>
              <div className="modal-dialog modal-dialog-centered modal-lg">
                <div className="modal-content card border-secondary bg-body text-body shadow-lg clear-theme-modal">
                  <div className="modal-header border-secondary">
                    <h5 className="modal-title text-info fw-bold">
                      <i className="bi bi-person-badge me-2"></i> Clearance Verification Result
                    </h5>
                    <Link href={`${basePath}/clearance${queryString}`} className="btn-close" />
                  </div>

                  <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
                    {!studentRecord ? (
                      <div className="alert border-warning bg-warning bg-opacity-10 text-warning py-4 text-center shadow-sm m-0">
                        <i className="bi bi-person-x-fill fs-3 d-block mb-2 text-warning"></i>
                        <strong className="fs-5">RECORD NOT FOUND</strong>
                        <div className="small mt-1 opacity-75">
                          No enrolled record matches <code>{q}</code> for {term} ({ay}). Please verify your entry or visit the department treasury office.
                        </div>
                      </div>
                    ) : (
                      <div className="card p-3 border-secondary shadow-sm mb-3 bg-body-secondary">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <span className="text-muted small fw-bold">STUDENT RECORD:</span>
                          <span className="badge border border-secondary text-info">{term} ({ay})</span>
                        </div>
                        <div className="small text-muted mb-2">Verification result for the supplied student credentials.</div>

                        {isCleared ? (
                          <div className="alert border-success bg-success bg-opacity-10 text-success py-3 mb-0 text-center shadow-sm">
                            <div className="fw-bold fs-5 mb-2">
                              <i className="bi bi-patch-check-fill me-2"></i> CLEARED FOR SIGNING
                            </div>
                            <div className="small opacity-75 mb-3 text-body">
                              Present this official QR code to the department adviser or custodian for digital sign-off.
                            </div>
                            <div className="d-inline-block p-2 bg-white rounded border border-success shadow-sm mb-2">
                              <Image
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(verifyUrl)}`}
                                alt="Clearance QR Code"
                                width={140}
                                height={140}
                                unoptimized
                              />
                            </div>
                            <div>
                              <a href={verifyUrl} target="_blank" rel="noopener noreferrer" className="btn btn-success btn-sm fw-bold mt-1 text-dark">
                                <i className="bi bi-box-arrow-up-right me-1"></i> Open Digital Certificate
                              </a>
                            </div>
                          </div>
                        ) : (
                          <div className="alert border-danger bg-danger bg-opacity-10 text-danger py-3 mb-0 text-center shadow-sm">
                            <div className="fw-bold fs-5 mb-1">
                              <i className="bi bi-exclamation-triangle-fill me-2"></i> CLEARANCE HOLD ACTIVE
                            </div>
                            <div className="small opacity-75 text-body mt-1">
                              Your clearance is currently on hold due to unsettled obligations. Please visit the department treasurer or auditor to verify and settle your account.
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="modal-footer border-secondary">
                    <Link href={`${basePath}/clearance${queryString}`} className="btn btn-secondary btn-sm">
                      Close View
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          <ClearanceClientView
            department={cleanDepartment}
            ay={ay}
            term={term}
            defaultStudentId={studentRecord?.studentId || q || ''}
            defaultFullName=""
            defaultEmail=""
            feeOptions={feeOptions}
            packageRate={termPkg.total}
            closed={isClosed}
          />
        </div>
      </main>
      {!hasSession && <DataPrivacyModal />}
    </div>
  );
}