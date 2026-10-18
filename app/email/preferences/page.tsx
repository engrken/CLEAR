import { prisma } from "@/lib/prisma";
import { normalizePreferenceEmail, verifyEmailPreferenceLink } from "@/lib/transaction-email-preferences";
import { saveEmailLinkPreferences } from "./actions";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Transaction Email Preferences | CLEAR" };

export default async function PublicEmailPreferencePage({searchParams}: {
  searchParams: Promise<{ token?: string; saved?: string }>;
}) {
  const search = await searchParams;
  const token = String(search.token || "");
  const target = verifyEmailPreferenceLink(token);
  if (!target) {
    return <main className="container py-5"><section className="card p-4 mx-auto" style={{ maxWidth: 600 }}>
      <h1 className="h4">Email preference link expired</h1>
      <p>This link is invalid or has expired. Use a more recent email or contact your school officer.</p>
    </section></main>;
  }
  const [organization, saved] = await Promise.all([
    prisma.organization.findUnique({ where: { id: target.org }, select: { name: true } }),
    prisma.transactionEmailPreference.findUnique({
      where: { organizationId_email: { organizationId: target.org,
        email: normalizePreferenceEmail(target.email) } },
    }),
  ]);
  if (!organization) return <main className="container py-5">This organization is unavailable.</main>;
  return <main className="container py-5">
    <section className="card shadow-sm p-4 mx-auto text-body bg-body" style={{ maxWidth: 620 }}>
      <div className="d-flex align-items-center gap-2 mb-3"><i className="bi bi-envelope-check fs-2 text-info" />
        <div><h1 className="h4 mb-1">Transaction Email Preferences</h1>
        <p className="text-body-secondary mb-0">{organization.name}</p></div>
      </div>
      {search.saved === "1" && <div className="alert alert-success">Preferences saved successfully.</div>}
      <p className="text-body-secondary small">These settings apply to routine CLEAR transaction emails sent to <strong>{target.email}</strong>. Your payment receipts and financial records remain stored in the system.</p>
      <form action={saveEmailLinkPreferences}>
        <input type="hidden" name="token" value={token} />
        <div className="form-check form-switch border rounded p-3 ps-5 mb-3">
          <input className="form-check-input" type="checkbox" name="participant" id="participant"
            defaultChecked={saved?.receiveParticipantEmails ?? true} />
          <label className="form-check-label fw-semibold" htmlFor="participant">Email me transaction notices and student/requestor receipts</label>
          <div className="form-text">Collections, penalties, arrears, remittance approvals/rejections, and other financial notices.</div>
        </div>
        <div className="form-check form-switch border rounded p-3 ps-5 mb-3">
          <input className="form-check-input" type="checkbox" name="officer" id="officer"
            defaultChecked={saved?.receiveOfficerCopies ?? true} />
          <label className="form-check-label fw-semibold" htmlFor="officer">Email me processing-officer duplicate copies</label>
          <div className="form-text">Duplicate receipts and accounting acknowledgments for transactions you process.</div>
        </div>
        <button className="btn btn-info fw-semibold" type="submit">Save Email Preferences</button>
      </form>
      <div className="alert alert-secondary small mt-3 mb-0">OTP, account-security messages, and legally required communications are outside these optional transaction email settings. Unsubscribing does not void any receipt.</div>
    </section>
  </main>;
}
