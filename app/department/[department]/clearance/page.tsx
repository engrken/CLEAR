import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { fmt, formatHoursAndMinutes } from '@/lib/utils';
import { format } from 'date-fns';
import crypto from 'crypto';
import Link from 'next/link';
import Image from 'next/image';
import ClearanceClientView from './ClearanceClientView';

// Legacy Term Packages Mapping
const termPackages: Record<string, number> = {
  "1st Sem": 650.00,
  "2nd Sem": 900.00,
  "Summer": 200.00
};

export default async function ClearancePage({
  params,
  searchParams,
}: {
  params: Promise<{ department: string }>;
  searchParams?: Promise<{ ay?: string; term?: string; q?: string; sig?: string }>;
}) {
  const { department } = await params;
  const resolvedSearch = searchParams ? await searchParams : {};
  const ay = resolvedSearch.ay || 'A.Y. 2026 - 2027';
  const term = resolvedSearch.term || '1st Sem';
  const q = resolvedSearch.q?.trim();
  const sigParam = resolvedSearch.sig?.trim();
  const baseUrl = `http://${department}.localhost:3000`;

  const organization = await prisma.organization.findUnique({
    where: { subdomain: department },
  });

  if (!organization) {
    return (
      <div className="alert alert-danger p-4 shadow-sm border-secondary">
        <h4 className="fw-bold mb-2">Department Not Found</h4>
        <p className="small mb-0">The department '{decodeURIComponent(department)}' does not exist.</p>
      </div>
    );
  }

  const session = await auth();
  const isOfficer = !!session?.user;

  // Cryptographic Signature Verification for Digital Certificate
  const salt = process.env.CLEARANCE_SALT || 'JIECEP_CLEARANCE_KEY_2026';
  
  if (sigParam && q) {
    const expectedSig = crypto.createHash('sha256').update(`${q}|${ay}|${term}|${salt}`).digest('hex');
    const isSignatureValid = (sigParam.toLowerCase() === expectedSig.toLowerCase());

    return (
      <div className="card p-4 border-secondary text-center shadow-lg" style={{ maxWidth: '500px', margin: '0 auto', marginTop: '2rem', backgroundColor: '#1e293b' }}>
        <h4 className="text-info fw-bold mb-1">College of {decodeURIComponent(department)}</h4>
        <small className="text-secondary d-block mb-4">Centralized Liquidation of Expense & Audit Records</small>
        
        {isSignatureValid ? (
          <>
            <div className="bg-success text-white p-3 rounded fw-bold fs-5 mb-4 shadow-sm">
              <i className="bi bi-check-circle-fill me-2"></i>OFFICIAL CLEARANCE VALID
            </div>
            <table className="table table-sm table-borderless text-start text-white mb-4">
              <tbody>
                <tr className="border-bottom border-secondary"><td className="text-secondary py-2">Student ID:</td><td className="fw-bold text-info py-2">{q}</td></tr>
                <tr className="border-bottom border-secondary"><td className="text-secondary py-2">Academic Term:</td><td className="py-2">{term} ({ay})</td></tr>
                <tr className="border-bottom border-secondary"><td className="text-secondary py-2">Verification Time:</td><td className="py-2">{format(new Date(), 'MMM dd, yyyy - hh:mm a')}</td></tr>
                <tr><td className="text-secondary py-2">Crypto Hash:</td><td className="font-monospace text-secondary small py-2">{sigParam.substring(0, 16)}...</td></tr>
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
    );
  }

  // Fetch Financial Ledger Data
  let studentRecord = null;
  let isCleared = false;
  const pendingDues: string[] = [];
  let collections: any[] = [];
  let penalties: any[] = [];
  let cashAdvances: any[] = [];
  let clearanceSig = "";
  let verifyUrl = "";

  if (q) {
    studentRecord = await prisma.student.findFirst({
      where: {
        organizationId: organization.id,
        OR: [
          { studentId: { equals: q, mode: 'insensitive' } },
          { email: { equals: q, mode: 'insensitive' } },
          { fullName: { contains: q, mode: 'insensitive' } }
        ]
      }
    });

    if (studentRecord) {
      [collections, penalties, cashAdvances] = await Promise.all([
        prisma.collection.findMany({
          where: { organizationId: organization.id, academicYear: ay, term, studentId: studentRecord.studentId },
          orderBy: { date: 'desc' }
        }),
        prisma.penalty.findMany({
          where: { organizationId: organization.id, academicYear: ay, term, studentId: studentRecord.studentId },
          orderBy: { date: 'desc' }
        }),
        prisma.cashAdvance.findMany({
          where: { organizationId: organization.id, academicYear: ay, term, requestor: { contains: studentRecord.studentId } },
          orderBy: { dateIssued: 'desc' }
        })
      ]);

      const pkgRate = termPackages[term] || 0;
      const deptFeePaid = collections
        .filter(c => c.category.includes('Departmental Fee') && !c.paymentType.toUpperCase().includes('VOID'))
        .reduce((sum, c) => sum + (c.amountPaid || 0), 0);

      if (pkgRate > 0 && deptFeePaid < pkgRate) {
        pendingDues.push(`Departmental Fee Package (${fmt(pkgRate - deptFeePaid)} remaining)`);
      }

      const unsettledPenalties = penalties.filter(p => !p.status.includes('Settled') && !p.status.includes('Voided'));
      if (unsettledPenalties.length > 0) {
        const totalPen = unsettledPenalties.reduce((sum, p) => sum + (p.fineAmount || 0), 0);
        pendingDues.push(`Unpaid Penalty Arrears (${fmt(totalPen)})`);
      }

      const activeAdvances = cashAdvances.filter(ca => ca.status.includes('Pending') && !ca.status.includes('Cancel'));
      if (activeAdvances.length > 0) {
        activeAdvances.forEach(ca => pendingDues.push(`Unliquidated Cash Advance [${ca.advanceId}]: ${fmt(ca.amountApproved)}`));
      }

      isCleared = (pendingDues.length === 0);

      if (isCleared) {
        const rawStr = `${studentRecord.studentId}|${ay}|${term}|${salt}`;
        clearanceSig = crypto.createHash('sha256').update(rawStr).digest('hex');
        verifyUrl = `${baseUrl}/clearance?ay=${ay}&term=${term}&q=${studentRecord.studentId}&sig=${clearanceSig}`;
      }
    }
  }

  return (
    <div className="module card p-3 p-md-4 border-secondary shadow-sm">
      <h5 className="text-accent mb-2"><i className="bi bi-person-check me-2"></i>Student Financial Clearance Verification</h5>
      <p className="text-secondary small mb-3">Verification requires your exact <strong>Student ID</strong> or registered <strong>Email Address</strong>. Officers must sign in to view itemized ledgers.</p>
      
      {/* SERVER-SIDE SEARCH FORM */}
      <form method="GET" action={`${baseUrl}/clearance`} className="mb-4">
        <input type="hidden" name="ay" value={ay} />
        <input type="hidden" name="term" value={term} />
        <div className="row g-2">
          <div className="col-12 col-md-8">
            <div className="input-group">
              <span className="input-group-text border-secondary text-secondary bg-card"><i className="bi bi-person-vcard"></i></span>
              <input 
                type="text" 
                name="q" 
                className="form-control bg-card text-color border-secondary" 
                placeholder="Enter student ID or registered email..." 
                defaultValue={q || ""}
                autoComplete="off" 
                required 
              />
            </div>
          </div>
          <div className="col-12 col-md-4 d-flex align-items-end">
            <button type="submit" className="btn btn-info w-100 fw-bold">
              <i className="bi bi-search me-1"></i>Check Clearance
            </button>
          </div>
        </div>
      </form>

      {/* MODAL WINDOW POPUP FOR SEARCH RESULTS */}
      {q && (
        <div className="modal fade show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content card border-secondary bg-dark text-white shadow-lg">
              <div className="modal-header border-secondary">
                <h5 className="modal-title text-accent"><i className="bi bi-person-badge me-2"></i>Clearance Verification Result</h5>
                <Link href={`${baseUrl}/clearance?ay=${ay}&term=${term}`} className="btn-close btn-close-white"></Link>
              </div>
              <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
                
                {/* RECORD NOT FOUND */}
                {!studentRecord && (
                  <div className="alert alert-warning py-4 text-center border-warning shadow-sm m-0">
                    <i className="bi bi-person-x-fill fs-3 d-block mb-2 text-warning"></i>
                    <strong className="fs-5">RECORD NOT FOUND</strong>
                    <div className="small mt-1 text-secondary">No enrolled record matches <code>{q}</code> for {term} ({ay}). Please verify your entry or visit the department treasury office.</div>
                  </div>
                )}

                {/* STUDENT RECORD FOUND */}
                {studentRecord && (
                  <>
                    <div className="card p-3 border-secondary shadow-sm mb-3 bg-card">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <span className="text-secondary small fw-bold">STUDENT RECORD:</span>
                        <span className="badge border border-secondary text-info">{term} ({ay})</span>
                      </div>
                      <h4 className="fw-bold text-accent mb-2">{studentRecord.fullName} <span className="text-secondary fs-6">({studentRecord.studentId})</span></h4>

                      {isCleared ? (
                        <div className="alert alert-success py-3 mb-0 text-center border-success shadow-sm">
                          <div className="fw-bold fs-5 mb-2"><i className="bi bi-patch-check-fill me-2 text-success"></i>CLEARED FOR SIGNING</div>
                          <div className="small text-secondary mb-3">Present this official QR code to the department adviser or custodian for digital sign-off.</div>
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
                            <a href={verifyUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline-success btn-sm fw-bold mt-1">
                              <i className="bi bi-box-arrow-up-right me-1"></i>Open Digital Certificate
                            </a>
                          </div>
                        </div>
                      ) : (
                        <div className="alert alert-danger py-3 mb-0 text-center border-danger shadow-sm">
                          <div className="fw-bold fs-5 mb-1"><i className="bi bi-exclamation-triangle-fill me-2"></i>CLEARANCE HOLD ACTIVE</div>
                          <div className="small text-secondary">This student has <strong>{pendingDues.length}</strong> pending obligation(s).</div>
                          {!isOfficer && <div className="small text-secondary mt-1">Please visit the department treasurer or auditor to settle your account.</div>}
                        </div>
                      )}
                    </div>

                    {/* OFFICER LEDGER BREAKDOWN */}
                    {isOfficer && (
                      <div className="card p-3 border-secondary shadow-sm bg-card">
                        <h6 className="fw-bold mb-3 text-accent"><i className="bi bi-shield-lock-fill me-2"></i>Officer Ledger Breakdown</h6>

                        {!isCleared && (
                          <div className="mb-3 p-2 bg-danger bg-opacity-10 border border-danger rounded">
                            <strong className="text-danger small d-block mb-1">Pending Obligations Blocking Clearance:</strong>
                            <ul className="text-danger small m-0 ps-3">
                              {pendingDues.map((due, i) => <li key={i}>{due}</li>)}
                            </ul>
                          </div>
                        )}

                        {collections.length > 0 && (
                          <>
                            <span className="text-secondary small fw-bold d-block mb-1"><i className="bi bi-receipt me-1 text-info"></i>Payment Remittance History</span>
                            <div className="table-responsive mb-3">
                              <table className="table table-sm align-middle text-white small">
                                <thead>
                                  <tr className="text-secondary border-bottom border-secondary">
                                    <th>Date</th><th>OR #</th><th>Item</th><th className="text-end">Paid</th><th className="text-end">Balance Due</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {collections.map(c => (
                                    <tr key={c.id}>
                                      <td>{format(new Date(c.date), 'yyyy-MM-dd')}</td>
                                      <td className="font-monospace text-warning">{c.orNumber}</td>
                                      <td>{c.itemDescription}</td>
                                      <td className="text-end text-success fw-bold">{fmt(c.amountPaid)}</td>
                                      <td className={`text-end ${c.balanceDue > 0 ? 'text-danger fw-bold' : ''}`}>{fmt(c.balanceDue)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </>
                        )}

                        {penalties.length > 0 && (
                          <>
                            <span className="text-secondary small fw-bold d-block mb-1"><i className="bi bi-exclamation-octagon me-1 text-danger"></i>Penalties & Late Fines</span>
                            <div className="table-responsive mb-3">
                              <table className="table table-sm align-middle text-white small">
                                <thead>
                                  <tr className="text-secondary border-bottom border-secondary">
                                    <th>Date</th><th>Activity</th><th>Duration</th><th className="text-end">Fine</th><th>Status</th><th className="text-center">Action</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {penalties.map(p => {
                                    const isUnsettled = !p.status.includes('Settled') && !p.status.includes('Voided');
                                    return (
                                      <tr key={p.id}>
                                        <td>{format(new Date(p.date), 'yyyy-MM-dd')}</td>
                                        <td>{p.activity}</td>
                                        <td><span className="badge border border-secondary text-info">{formatHoursAndMinutes(p.hoursLate)}</span></td>
                                        <td className="text-end text-danger fw-bold">{fmt(p.fineAmount)}</td>
                                        <td><span className={`badge ${isUnsettled ? 'bg-danger' : 'bg-success'}`}>{p.status}</span></td>
                                        <td className="text-center">
                                          {isUnsettled ? (
                                            <Link href={`${baseUrl}/collections?ay=${ay}&term=${term}&prefillId=${p.studentId}`} className="btn btn-outline-info btn-sm py-0">Pay</Link>
                                          ) : '—'}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </>
                        )}

                        {cashAdvances.length > 0 && (
                          <>
                            <span className="text-secondary small fw-bold d-block mb-1"><i className="bi bi-journal-arrow-up me-1 text-warning"></i>Cash Advance & Liquidation Status</span>
                            <div className="table-responsive mb-0">
                              <table className="table table-sm align-middle text-white small">
                                <thead>
                                  <tr className="text-secondary border-bottom border-secondary">
                                    <th>Date Issued</th><th>CA ID</th><th>Fund Source</th><th className="text-end">Amount</th><th>Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {cashAdvances.map(ca => {
                                    const isPending = ca.status.includes('Pending');
                                    return (
                                      <tr key={ca.id}>
                                        <td>{format(new Date(ca.dateIssued), 'yyyy-MM-dd')}</td>
                                        <td className="font-monospace">{ca.advanceId}</td>
                                        <td>{ca.fundSource}</td>
                                        <td className={`text-end fw-bold ${isPending ? 'text-warning' : 'text-success'}`}>{fmt(ca.amountApproved)}</td>
                                        <td><span className={`badge ${isPending ? 'bg-warning text-dark' : 'bg-success'}`}>{ca.status}</span></td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </>
                )}

              </div>
              <div className="modal-footer border-secondary">
                <Link href={`${baseUrl}/clearance?ay=${ay}&term=${term}`} className="btn btn-secondary btn-sm">Close</Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* INTERACTIVE CLIENT COMPONENT FOR GCASH / MAYA PROOF MODAL */}
      <ClearanceClientView 
        department={department}
        ay={ay}
        term={term}
        defaultStudentId={studentRecord?.studentId || q || ""}
        defaultFullName={studentRecord?.fullName || ""}
        defaultEmail={studentRecord?.email || ""}
      />
    </div>
  );
}