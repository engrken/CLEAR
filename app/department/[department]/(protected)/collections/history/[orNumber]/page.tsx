import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireTabAccess } from "@/lib/permissions";
import PrintReceiptButton from "./PrintReceiptButton";
import { cleanOrNumber, getReceiptLines, money, receiptStatus } from "../receipt-data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Receipt Reprint | CLEAR System" };
export default async function PrintCollectionsReceipt({ params }: {
  params: Promise<{ department: string; orNumber: string }>;
}) {
  const { department, orNumber: rawOr } = await params;
  const slug = decodeURIComponent(department).trim().toLowerCase();
  await requireTabAccess("tab-payment", slug);
  const org = await prisma.organization.findUnique({ where: { subdomain: slug },
    select: { id: true, name: true, reportSchoolName: true, reportSchoolAddress: true } });
  if (!org) return <div className="alert alert-danger">Department not found.</div>;
  const orNumber = cleanOrNumber(decodeURIComponent(rawOr));
  const rows = await getReceiptLines(org.id, orNumber);
  if (!rows.length) return <div className="alert alert-warning">This receipt does not exist for your organization.</div>;
  const status = rows.filter(r => r.orNumber.toUpperCase() === orNumber).length !== 1 ||
    new Set(rows.map(r => `${r.academicYear}|${r.term}|${r.studentId}`)).size !== 1
    ? "Inconsistent" : receiptStatus(rows);
  const first = rows.find(r => r.orNumber.toUpperCase() === orNumber) || rows[0];
  const total = rows.reduce((sum, row) => sum + Math.round(row.amountPaid * 100), 0) / 100;
  return <>
    <style>{`@media print {
      @page { size: A4; margin: 14mm; }
      body * { visibility: hidden !important; }
      #clear-reprint, #clear-reprint * { visibility: visible !important; }
      #clear-reprint { position: fixed !important; left: 0 !important; top: 0 !important;
         background: #fff !important; color: #151b24 !important; width: 100% !important;
         border: none !important; box-shadow: none !important; padding: 10mm !important;
         max-width: none !important; z-index: 2147483647; }
      #clear-reprint * { color: #151b24 !important; }
      .receipt-no-print { display: none !important; }
    }`}</style>
    <div className="d-flex flex-wrap gap-2 mb-3 receipt-no-print">
      <Link href={`/department/${encodeURIComponent(slug)}/collections/history?ay=all&term=all`} className="btn btn-outline-secondary">Back to Receipt History</Link>
      <PrintReceiptButton />
    </div>
    <article id="clear-reprint" className="card p-4 mx-auto shadow-sm border-secondary position-relative" style={{ maxWidth: 820 }}>
      {status !== "Valid" && <div role="alert" className="alert alert-danger fw-bold text-center fs-3">
        {status === "Voided" ? "VOIDED RECEIPT — NOT VALID FOR PAYMENT" : "RECEIPT UNDER REVIEW — DO NOT USE"}
      </div>}
      <header className="text-center mb-3">
        <h4 className="mb-1">{org.reportSchoolName || org.name}</h4>
        {org.reportSchoolAddress && <p className="mb-1 small">{org.reportSchoolAddress}</p>}
        <h5 className="mt-3">{status === "Valid" ? "OFFICIAL PAYMENT RECEIPT (COPY)" : "RECEIPT AUDIT COPY"}</h5>
        <div className="small text-muted">Reprint of the original transaction. No new payment recorded.</div>
      </header>
      <div className="row mb-3 g-2">
        <div className="col-6"><strong>OR:</strong> {orNumber}</div>
        <div className="col-6 text-end"><strong>Date:</strong> {first.date.toISOString().slice(0,10)}</div>
        <div className="col-12"><strong>Student:</strong> {first.studentName}</div>
        <div className="col-12"><strong>Academic period:</strong> {first.academicYear} — {first.term}</div>
        <div className="col-12"><strong>Processed by:</strong> {first.encodedBy || "CLEAR Officer"}</div>
      </div>
      <div className="table-responsive"><table className="table table-bordered table-sm">
        <thead><tr><th>Category</th><th>Collection item</th><th>Fund allocation</th><th className="text-end">Paid</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.id}><td>{row.category}</td><td>{row.itemDescription}</td>
          <td>{row.fundAllocation}</td><td className="text-end">{money(row.amountPaid)}</td></tr>)}</tbody>
        <tfoot><tr className="fw-bold"><td colSpan={3}>OR Total</td><td className="text-end">{money(total)}</td></tr></tfoot>
      </table></div>
      <p className="text-muted small mb-0 mt-3">This is a copy of a previously issued receipt. For verification, refer to the original OR and CLEAR audit records. A voided receipt is not proof of current payment.</p>
    </article>
  </>;
}
