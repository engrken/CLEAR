import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { normalizePreferenceEmail } from "@/lib/transaction-email-preferences";
import { saveMyEmailPreferences } from "./actions";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Email Preferences | CLEAR" };

export default async function OfficerEmailPreferences({params}: {
  params: Promise<{department:string}>;
}) {
  const {department} = await params;
  const dep = String(department).trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(dep)) redirect("/dashboard");
  const session = await auth();
  if (!session?.user?.email) redirect(`/department/${dep}?login=true`);
  const org = await prisma.organization.findUnique({where:{subdomain:dep},select:{id:true,name:true}});
  if (!org || String((session.user as {organizationId?:string}).organizationId || "") !== org.id)
    redirect(`/department/${dep}?forbidden=true`);
  const email = normalizePreferenceEmail(session.user.email);
  const user = await prisma.tenantUser.findFirst({ where:{ organizationId:org.id,
    email: {equals:email,mode:"insensitive"}, status:"Active" }, select:{id:true} });
  if (!user) redirect(`/department/${dep}?forbidden=true`);
  const pref = await prisma.transactionEmailPreference.findUnique({
    where:{ organizationId_email:{organizationId:org.id,email} },
  });
  const save = saveMyEmailPreferences.bind(null, dep);
  return <div className="container-fluid py-4" style={{maxWidth:800}}>
    <div className="card bg-body text-body border-secondary shadow-sm p-4">
      <h1 className="h4 mb-2"><i className="bi bi-envelope-check text-info me-2"/>My Email Preferences</h1>
      <p className="text-body-secondary small">{org.name} · {email}</p>
      <p>Choose which optional financial transaction emails you receive. Settings apply across Collections, Penalties, Online Remittances, Historical Arrears, Cashier, Cash Advances, and Liquidations.</p>
      <form action={save}>
        <div className="form-check form-switch border rounded p-3 ps-5 mb-3">
          <input className="form-check-input" type="checkbox" name="participant" id="participant"
            defaultChecked={pref?.receiveParticipantEmails ?? true}/>
          <label className="form-check-label fw-semibold" htmlFor="participant">Receive emails about transactions involving me</label>
          <div className="form-text">Student/requestor receipts, approvals, rejections, and financial notices.</div>
        </div>
        <div className="form-check form-switch border rounded p-3 ps-5 mb-3">
          <input className="form-check-input" type="checkbox" name="officer" id="officer"
            defaultChecked={pref?.receiveOfficerCopies ?? true}/>
          <label className="form-check-label fw-semibold" htmlFor="officer">Send me duplicate receipts when I process transactions</label>
          <div className="form-text">This affects your own officer copy only. The student's email preference is independent.</div>
        </div>
        <button className="btn btn-info fw-semibold" type="submit">Save Email Preferences</button>
      </form>
      <p className="text-body-secondary small mt-3 mb-0">Digital receipts remain recorded in CLEAR even when emails are disabled. OTP/security emails are unaffected.</p>
    </div>
  </div>;
}
