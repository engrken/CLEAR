// /app/department/[department]/clearance/page.tsx

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { fmt } from '@/lib/utils';
import { formatInTimeZone } from 'date-fns-tz';
import { headers } from 'next/headers';
import crypto from 'crypto';
import Link from 'next/link';
import Image from 'next/image';
import ClearanceClientView from './ClearanceClientView';
import ClearanceManager from './ClearanceManager';
import DataPrivacyModal from '../components/DataPrivacyModal';
import { Metadata } from 'next';
import { getDepartmentFinancials } from '../actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Centralized Liquidation of Expense & Audit Records',
};

const PublicHeader = ({ organizationName }: { organizationName: string }) => {
  const displayOrgName = organizationName.toLowerCase() 
    ? organizationName : `College of ${organizationName}`;
  return (
    <header className="navbar border-bottom border-secondary px-4 py-3 bg-body shadow-sm d-print-none text-body">
      <div className="d-flex align-items-center gap-3 w-100">
        <img src="/fcu.png" alt="FCU Logo" style={{ width: '55px', objectFit: 'contain' }} />
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
  const host = headersList.get('host') || 'localhost:3000';
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

  const session = await auth();
  const isOfficer = !!session?.user;

  const financials = await getDepartmentFinancials(organization.id, ay, term, !isOfficer);
  const termPkg = financials.termPkg;

  const collectionSetups = await prisma.collectionSetup.findMany({
    where: { organizationId: organization.id, academicYear: ay, term },
    orderBy: { name: 'asc' }
  });

  const feeOptions = [
    { name: "Departmental Fee (Full Package)", amount: termPkg.total },
    ...collectionSetups.map(c => ({
      name: c.name,
      amount: c.amount
    }))
  ];

  const salt = process.env.CLEARANCE_SALT || 'CLEARANCE_KEY_2026';

  if (sigParam && q) {
    const expectedSig = crypto.createHash('sha256').update(`${q.toLowerCase()}|${ay}|${term}|${salt}`).digest('hex');
    const isSignatureValid = sigParam.toLowerCase() === expectedSig.toLowerCase();
    const displayOrgName = organization.name.toLowerCase() ? organization.name : `College of ${organization.name}`;

    return (
      <div className="d-flex flex-column min-vh-100 bg-body-tertiary text-body">
        {!isOfficer && <PublicHeader organizationName={organization.name} />}
        <main className="flex-grow-1 p-3 p-md-5 w-100 d-flex align-items-center justify-content-center">
          <div className="card p-4 border-secondary text-center shadow-lg w-100 bg-body text-body" style={{ maxWidth: '500px' }}>
            <h4 className="text-info fw-bold mb-1">{displayOrgName}</h4>
            <small className="text-muted d-block mb-4">Centralized Liquidation of Expenses & Audit Records</small>

            {isSignatureValid ? (
              <>
                <div className="bg-success text-white p-3 rounded fw-bold fs-5 mb-4 shadow-sm"><i className="bi bi-check-circle-fill me-2"></i>OFFICIAL CLEARANCE VALID</div>
                <table className="table table-sm table-borderless text-start text-body mb-4">
                  <tbody>
                    <tr className="border-bottom border-secondary"><td className="text-muted py-2">Student ID:</td><td className="fw-bold text-info py-2">{q}</td></tr>
                    <tr className="border-bottom border-secondary"><td className="text-muted py-2">Academic Term:</td><td className="py-2">{term} ({ay})</td></tr>
                    <tr className="border-bottom border-secondary">
                      <td className="text-muted py-2">Verification Time:</td>
                      <td className="py-2">{formatInTimeZone(new Date(), 'Asia/Manila', 'MMM dd, yyyy - hh:mm a')}</td>
                    </tr>
                    <tr><td className="text-muted py-2">Crypto Hash:</td><td className="font-monospace text-muted small py-2">{sigParam.substring(0, 16)}...</td></tr>
                  </tbody>
                </table>
                <p className="text-success small fw-semibold m-0">This certificate confirms zero financial arrears, penalties, or unliquidated advances for the specified period.</p>
              </>
            ) : (
              <div className="bg-danger text-white p-3 rounded fw-bold fs-5 mb-3 shadow-sm">
                <i className="bi bi-x-circle-fill me-2"></i>INVALID OR TAMPERED
                <p className="fs-6 fw-normal m-0 mt-2">This clearance token does not match department records, or active obligations were logged after issuance.</p>
              </div>
            )}
          </div>
        </main>
        {!isOfficer && <><DataPrivacyModal /></>}
      </div>
    );
  }

  if (isOfficer && !sigParam) {
    const [allStudents, allCollections, allPenalties, allAdvances] = await Promise.all([
      prisma.student.findMany({ where: { organizationId: organization.id }, orderBy: { fullName: 'asc' } }),
      prisma.collection.findMany({ where: { organizationId: organization.id, academicYear: ay, term } }),
      prisma.penalty.findMany({ where: { organizationId: organization.id, academicYear: ay, term } }),
      prisma.cashAdvance.findMany({ where: { organizationId: organization.id, academicYear: ay, term } })
    ]);

    const validCollections = allCollections.filter(c => !String(c.paymentType || '').toUpperCase().includes('VOID'));

    const clearanceRoster = allStudents.map(student => {
      const unpaidItems: any[] = [];
      const studentKey = String(student.studentId || '').toLowerCase();
      const studentNameKey = String(student.fullName || '').toLowerCase();

      const myCollections = validCollections.filter(c => 
        (c.studentId && String(c.studentId).toLowerCase() === studentKey) || 
        (c.studentName && String(c.studentName).toLowerCase() === studentNameKey)
      );

      const packagePaid = myCollections.filter(c => {
        const descLower = String(c.itemDescription || '').toLowerCase();
        return termPkg.items.some((pi: any) => String(pi.name).toLowerCase() === descLower) || descLower.includes('package') || descLower === 'departmental fee';
      }).reduce((sum, c) => sum + (Number(c.amountPaid) || 0), 0);

      if (termPkg.total > 0 && packagePaid < termPkg.total) {
        unpaidItems.push({ category: 'Departmental Fee', itemDescription: 'Mandatory Package Balance', balanceDue: termPkg.total - packagePaid });
      }

      const standaloneItems = myCollections.filter(c => {
        const descLower = String(c.itemDescription || '').toLowerCase();
        const isPackageItem = termPkg.items.some((pi: any) => String(pi.name).toLowerCase() === descLower) || descLower.includes('package') || descLower === 'departmental fee';
        return !isPackageItem && Number(c.balanceDue) > 0;
      });

      const processedStandalone = new Set<string>();
      for (const item of standaloneItems) {
        if (!processedStandalone.has(item.itemDescription)) {
          processedStandalone.add(item.itemDescription);
          unpaidItems.push({ category: item.category, itemDescription: item.itemDescription, balanceDue: item.balanceDue });
        }
      }

      const myPenalties = allPenalties.filter(p => 
        String(p.studentId || '').toLowerCase() === studentKey && 
        !String(p.status || '').includes('Settled') && 
        !String(p.status || '').includes('Voided')
      );

      if (myPenalties.length > 0) {
        const totalPen = myPenalties.reduce((sum, p) => sum + (Number(p.fineAmount) || 0), 0);
        unpaidItems.push({ category: 'Penalty', itemDescription: 'Unsettled Fine / Arrears', balanceDue: totalPen });
      }

      const myAdvances = allAdvances.filter(ca => 
        String(ca.requestor || '').toLowerCase().includes(studentKey) && 
        String(ca.status || '').includes('Pending') && 
        !String(ca.status || '').includes('Cancel')
      );

      if (myAdvances.length > 0) {
        myAdvances.forEach(ca => unpaidItems.push({ category: 'Cash Advance', itemDescription: `Unliquidated CA [${ca.advanceId}]`, balanceDue: ca.amountApproved }));
      }

      return {
        studentId: student.studentId,
        fullName: student.fullName,
        email: student.email,
        isCleared: unpaidItems.length === 0,
        unpaidItems
      };
    });

    return (
      <div className="d-flex flex-column min-vh-100 bg-body-tertiary">
        <main className="flex-grow-1 p-3 p-md-5 mx-auto w-100" style={{ maxWidth: '1200px' }}>
          <div className="module card p-3 p-md-4 border-secondary shadow-sm h-100 bg-body text-body">
            <h5 className="text-info mb-3 fw-bold"><i className="bi bi-shield-check me-2"></i> Officer Clearance Dashboard</h5>
            <ClearanceManager 
              department={cleanDepartment}
              ay={ay} 
              term={term}
              students={clearanceRoster} 
              feeOptions={feeOptions} 
              packageRate={termPkg.total}
            />
          </div>
        </main>
      </div>
    );
  }

  let studentRecord = null;
  let isCleared = false;
  const pendingDues: string[] = [];
  let clearanceSig = "";
  let verifyUrl = "";

  if (q && !isOfficer) {
    studentRecord = await prisma.student.findFirst({
      where: {
        organizationId: organization.id,
        OR: [{ studentId: { equals: q, mode: 'insensitive' } }, { email: { equals: q, mode: 'insensitive' } }]
      }
    });

    if (studentRecord) {
      const [collections, penalties, cashAdvances] = await Promise.all([
        prisma.collection.findMany({
          where: { 
            organizationId: organization.id, academicYear: ay, term,
            OR: [{ studentId: { equals: studentRecord.studentId, mode: 'insensitive' } }, { studentName: { equals: studentRecord.fullName, mode: 'insensitive' } }]
          }
        }),
        prisma.penalty.findMany({
          where: { organizationId: organization.id, academicYear: ay, term, studentId: studentRecord.studentId }
        }),
        prisma.cashAdvance.findMany({
          where: { organizationId: organization.id, academicYear: ay, term, requestor: { contains: studentRecord.studentId } }
        })
      ]);

      const validCollections = collections.filter(c => !String(c.paymentType || '').toUpperCase().includes('VOID'));

      const packagePaid = validCollections.filter(c => {
        const descLower = String(c.itemDescription || '').toLowerCase();
        return termPkg.items.some((pi: any) => String(pi.name).toLowerCase() === descLower) || descLower.includes('package') || descLower === 'departmental fee';
      }).reduce((sum, c) => sum + (Number(c.amountPaid) || 0), 0);

      if (termPkg.total > 0 && packagePaid < termPkg.total) {
        pendingDues.push(`Departmental Fee Package (${fmt(termPkg.total - packagePaid)} remaining)`);
      }

      const standaloneItems = validCollections.filter(c => {
        const descLower = String(c.itemDescription || '').toLowerCase();
        const isPackageItem = termPkg.items.some((pi: any) => String(pi.name).toLowerCase() === descLower) || descLower.includes('package') || descLower === 'departmental fee';
        return !isPackageItem && Number(c.balanceDue) > 0;
      });

      const processedItems = new Set<string>();
      for (const item of standaloneItems) {
        if (!processedItems.has(item.itemDescription)) {
          processedItems.add(item.itemDescription);
          pendingDues.push(`${item.itemDescription} (${fmt(item.balanceDue)} remaining)`);
        }
      }

      const unsettledPenalties = penalties.filter(p => !String(p.status || '').includes('Settled') && !String(p.status || '').includes('Voided'));
      if (unsettledPenalties.length > 0) {
        const totalPen = unsettledPenalties.reduce((sum, p) => sum + (Number(p.fineAmount) || 0), 0);
        pendingDues.push(`Unpaid Penalty Arrears (${fmt(totalPen)})`);
      }

      const activeAdvances = cashAdvances.filter(ca => String(ca.status || '').includes('Pending') && !String(ca.status || '').includes('Cancel'));
      if (activeAdvances.length > 0) {
        activeAdvances.forEach(ca => { pendingDues.push(`Unliquidated Cash Advance [${ca.advanceId}]: ${fmt(ca.amountApproved)}`); });
      }

      isCleared = pendingDues.length === 0;

      if (isCleared) {
        const rawStr = `${studentRecord.studentId.toLowerCase()}|${ay}|${term}|${salt}`;
        clearanceSig = crypto.createHash('sha256').update(rawStr).digest('hex');
        verifyUrl = `${absoluteBaseUrl}${basePath}/clearance?ay=${encodeURIComponent(ay)}&term=${encodeURIComponent(term)}&q=${encodeURIComponent(studentRecord.studentId)}&sig=${encodeURIComponent(clearanceSig)}`;
      }
    }
  }

  return (
    <div className="d-flex flex-column min-vh-100 bg-body-tertiary">
      <PublicHeader organizationName={organization.name} />
      <main className="flex-grow-1 p-3 p-md-5 mx-auto w-100 text-body" style={{ maxWidth: '1200px' }}>
        <div className="module card p-3 p-md-4 border-secondary shadow-sm h-100 bg-body">
          <h5 className="text-info mb-2 fw-bold"><i className="bi bi-person-check me-2"></i>Student Financial Clearance Verification</h5>
          <p className="text-muted small mb-3">Verification requires your exact <strong>Student ID</strong> or registered <strong>Email Address</strong>.</p>

          <form method="GET" action={`${basePath}/clearance`} className="mb-4">
            <input type="hidden" name="ay" value={ay} />
            <input type="hidden" name="term" value={term} />
            <div className="row g-2">
              <div className="col-12 col-md-8">
                <div className="input-group">
                  <span className="input-group-text border-secondary text-muted bg-body-secondary"><i className="bi bi-person-vcard"></i></span>
                  <input type="text" name="q" className="form-control bg-body text-body border-secondary" placeholder="Enter student ID or registered email..." defaultValue={q || ""} autoComplete="off" required />
                </div>
              </div>
              <div className="col-12 col-md-4 d-flex align-items-end">
                <button type="submit" className="btn btn-info text-dark w-100 fw-bold"><i className="bi bi-search me-1"></i> Check Clearance</button>
              </div>
            </div>
          </form>

          {q && (
            <div className="modal fade show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}>
              <div className="modal-dialog modal-dialog-centered modal-lg">
                <div className="modal-content card border-secondary bg-body text-body shadow-lg">
                  <div className="modal-header border-secondary">
                    <h5 className="modal-title text-info fw-bold"><i className="bi bi-person-badge me-2"></i> Clearance Verification Result</h5>
                    <Link href={`${basePath}/clearance${queryString}`} className="btn-close" />
                  </div>

                  <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
                    {!studentRecord ? (
                      <div className="alert border-warning bg-warning bg-opacity-10 text-warning py-4 text-center shadow-sm m-0">
                        <i className="bi bi-person-x-fill fs-3 d-block mb-2 text-warning"></i>
                        <strong className="fs-5">RECORD NOT FOUND</strong>
                        <div className="small mt-1 opacity-75">No enrolled record matches <code>{q}</code> for {term} ({ay}). Please verify your entry or visit the department treasury office.</div>
                      </div>
                    ) : (
                      <div className="card p-3 border-secondary shadow-sm mb-3 bg-body-secondary">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <span className="text-muted small fw-bold">STUDENT RECORD:</span>
                          <span className="badge border border-secondary text-info">{term} ({ay})</span>
                        </div>
                        <h4 className="fw-bold text-info mb-2">{studentRecord.fullName} <span className="text-muted fs-6">({studentRecord.studentId})</span></h4>

                        {isCleared ? (
                          <div className="alert border-success bg-success bg-opacity-10 text-success py-3 mb-0 text-center shadow-sm">
                            <div className="fw-bold fs-5 mb-2"><i className="bi bi-patch-check-fill me-2"></i> CLEARED FOR SIGNING</div>
                            <div className="small opacity-75 mb-3 text-body">Present this official QR code to the department adviser or custodian for digital sign-off.</div>
                            <div className="d-inline-block p-2 bg-white rounded border border-success shadow-sm mb-2">
                              <Image src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(verifyUrl)}`} alt="Clearance QR Code" width={140} height={140} unoptimized />
                            </div>
                            <div><a href={verifyUrl} target="_blank" rel="noopener noreferrer" className="btn btn-success btn-sm fw-bold mt-1 text-dark"><i className="bi bi-box-arrow-up-right me-1"></i> Open Digital Certificate</a></div>
                          </div>
                        ) : (
                          <div className="alert border-danger bg-danger bg-opacity-10 text-danger py-3 mb-0 text-center shadow-sm">
                            <div className="fw-bold fs-5 mb-1"><i className="bi bi-exclamation-triangle-fill me-2"></i> CLEARANCE HOLD ACTIVE</div>
                            <div className="small opacity-75 text-body">This student has <strong>{pendingDues.length}</strong> pending obligation(s).</div>
                            <div className="small opacity-75 text-body mt-1">Please visit the department treasurer or auditor to settle your account.</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="modal-footer border-secondary">
                    <Link href={`${basePath}/clearance${queryString}`} className="btn btn-secondary btn-sm">Close View</Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          <ClearanceClientView
            department={cleanDepartment}
            ay={ay}
            term={term}
            defaultStudentId={studentRecord?.studentId || q || ""}
            defaultFullName={studentRecord?.fullName || ""}
            defaultEmail={studentRecord?.email || ""}
            feeOptions={feeOptions}
            packageRate={termPkg.total}
          />
        </div>
      </main>
      {!isOfficer && (
        <>
          <DataPrivacyModal />
        </>
      )}
    </div>
  );
}