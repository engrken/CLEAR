import type { Metadata } from 'next';
import Link from 'next/link';
import { readClearanceCertificate } from '@/lib/clearance-opaque-token';
import { prisma } from '@/lib/prisma';
import { getStudentClearance } from '@/lib/clearance';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Verify CLEAR certificate', referrer: 'no-referrer',
  robots: { index: false, follow: false, noarchive: true },
};
export default async function VerifyCertificatePage({ searchParams }:{
  searchParams?: Promise<{ token?: string }>,
}) {
  const { token } = searchParams ? await searchParams : {};
  const claim = readClearanceCertificate(String(token || ''));
  let isValid = false;
  if (claim) {
    const org = await prisma.organization.findUnique({ where: { id: claim.orgId },
      select: { id: true, activeAy: true, activeTerm: true } });
    if (org && org.activeAy === claim.ay && org.activeTerm === claim.term) {
      // Verify CURRENT enrollment and obligations; signatures alone are not clearance.
      const current = await getStudentClearance(org.id, claim.studentId, claim.ay, claim.term);
      isValid = !!current && current.student.id === claim.studentPk &&
        current.student.studentId.toLowerCase() === claim.studentId.toLowerCase() && current.isCleared;
    }
  }
  return <main className="min-vh-100 bg-body-tertiary d-flex align-items-center justify-content-center p-4">
    <article className="card p-4 shadow border-secondary text-center w-100" style={{maxWidth:560}}>
      <img alt="CLEAR" src="/clearsys.png" height={72} width={72} className="mx-auto mb-3"/>
      <h1 className="h4 fw-bold">CLEAR digital certificate verification</h1>
      <div role="status" className={isValid?'alert alert-success mt-3 fw-bold':'alert alert-danger mt-3 fw-bold'}>
        {isValid?'OFFICIAL CLEARANCE VALID':'CERTIFICATE INVALID, EXPIRED OR ON HOLD'}
      </div>
      <p className="small text-muted">{isValid
        ? 'Current enrollment and recorded financial obligations have been verified.'
        : 'An expired certificate, revoked enrollment or outstanding obligation cannot be verified as cleared.'}</p>
      <p className="small text-muted">This public screen does not display student identities or financial balances.</p>
      <Link href="/" className="btn btn-outline-secondary">Return to CLEAR</Link>
    </article>
  </main>;
}
