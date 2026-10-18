import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireTabAccess } from "@/lib/permissions";
import { listHistoricalDebts } from "@/lib/student-arrears";
import { getPeriodLedger } from "../../realign/ledger";
import ArrearsPaymentClient from "./ArrearsPaymentClient";

export const dynamic = "force-dynamic";
export default async function ArrearsPage({ params, searchParams }: {
  params: Promise<{ department: string }>;
  searchParams: Promise<{ studentId?: string; ay?: string; term?: string }>;
}) {
  const { department } = await params;
  const dep = decodeURIComponent(department).trim().toLowerCase();
  await requireTabAccess("tab-payment", dep);
  const search = await searchParams;
  const org = await prisma.organization.findUnique({ where: { subdomain: dep },
    select: { id: true, activeAy: true, activeTerm: true } });
  if (!org) return <div className="alert alert-danger">Tenant not found.</div>;
  const studentInput = String(search.studentId || "").trim();
  const student = studentInput ? await prisma.student.findFirst({ where: { organizationId: org.id,
    OR: [{ id: studentInput }, { studentId: { equals: studentInput, mode: "insensitive" } }] } }) : null;
  const ledger = await getPeriodLedger(prisma, org.id, org.activeAy, org.activeTerm);
  const debts = student ? await listHistoricalDebts(prisma, org.id, org.activeAy, org.activeTerm, student.studentId) : [];
  return <div className="module card p-3 p-md-4 bg-body text-body border-secondary">
    <h5 className="fw-bold text-info">Previous-Period Student Arrears</h5>
    <p className="text-muted small">Old assessments remain enforceable. New money is receipted in {org.activeTerm} ({org.activeAy}).</p>
    <form method="get" className="d-flex flex-wrap gap-2 mb-3">
      <input name="studentId" className="form-control" style={{maxWidth:350}} placeholder="Exact student ID" defaultValue={studentInput}/>
      <button className="btn btn-outline-info">Find Student</button>
      <Link href={`/department/${dep}/collections?ay=${encodeURIComponent(org.activeAy)}&term=${encodeURIComponent(org.activeTerm)}`} className="btn btn-outline-secondary">Back to Collections</Link>
    </form>
    {studentInput && !student && <div className="alert alert-warning">Student not found in this organization.</div>}
    {student && <><h6>{student.fullName} ({student.studentId})</h6>
      {debts.length ? <><div className="alert alert-warning">{debts.length} historical obligation(s); total ₱{debts.reduce((n,d)=>n+d.balanceDue,0).toFixed(2)} outstanding.</div>
        {ledger.activeRollover ? <div className="alert alert-danger">Current period is closed. Open a valid period before receiving payment.</div> : <ArrearsPaymentClient department={dep} ay={org.activeAy} term={org.activeTerm} studentId={student.studentId} debts={debts}/>}</>
      : <div className="alert alert-success">No previous-period assessed penalties or collectibles remain unpaid.</div>}
    </>}
  </div>;
}
