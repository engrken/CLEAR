import Link from 'next/link';
import { requireTenantMember } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import OfficerAiChat from './OfficerAiChat';
import { canUseAiRollout, isAiPaidTier } from '@/lib/ai/policy';

export default async function OfficerAiPage({ params }: { params: Promise<{ department: string }> }) {
  const { department } = await params;
  const officer = await requireTenantMember(department);
  if (officer.isSuper) {
    return <div className="alert alert-warning">CLEAR AI is limited to authenticated tenant officers.</div>;
  }
  const organization = await prisma.organization.findUnique({
    where: { id: officer.organizationId },
    select: { subdomain: true, tier: true, name: true },
  });
  const premium = isAiPaidTier(organization?.tier);
  const rolloutAllowed = organization ? canUseAiRollout(
    organization.subdomain, officer.email,
    process.env.CLEAR_AI_ALLOWED_OFFICERS,
    process.env.CLEAR_AI_ROLLOUT_MODE,
  ) : false;
  return (
    <div className="container-fluid" style={{ maxWidth: 980 }}>
      <header className="mb-4">
        <h1 className="h3 fw-bold"><i className="bi bi-stars me-2 text-primary" />CLEAR AI Assistant</h1>
        <p className="text-secondary mb-0">Ask about authorized records and prepare explanations in English or Filipino.</p>
      </header>
      {process.env.CLEAR_AI_ENABLED !== 'true' ? (
        <div className="alert alert-secondary">CLEAR AI is not yet enabled for this environment.</div>
      ) : !premium ? (
        <div className="card border rounded-4 shadow-sm p-4">
          <span className="badge text-bg-primary align-self-start mb-3">Pro &amp; Corporate feature</span>
          <h2 className="h5 fw-bold">Unlock CLEAR AI</h2>
          <p className="text-secondary">Your organization is on the {organization?.tier || 'current'} tier.
          Upgrade through your organization administrator to access the assistant.</p>
          <div className="rounded-3 bg-body-tertiary p-3 mb-3">
            <small className="text-secondary">SAMPLE ONLY — not a live record</small>
            <p className="mb-1 fw-semibold">What can you help me with?</p>
            <p className="mb-0">I can explain authorized financial summaries, draft report text,
            and answer administrative questions without changing records.</p>
          </div>
          <Link href={`/department/${encodeURIComponent(department)}`} className="btn btn-outline-primary align-self-start">
            Return to dashboard
          </Link>
        </div>
      ) : !rolloutAllowed ? (
        <div className="alert alert-secondary">
          CLEAR AI is rolling out gradually to authorized officers. Your account is not yet enabled.
        </div>
      ) : <OfficerAiChat department={department} organizationName={organization?.name || department} />}
      <p className="small text-secondary mt-3">
        AI may make mistakes. Verify all amounts against official reports. No financial records can be changed from this assistant.
      </p>
    </div>
  );
}
