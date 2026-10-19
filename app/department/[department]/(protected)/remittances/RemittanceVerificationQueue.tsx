// /app/department/[department]/(protected)/remittances/RemittanceVerificationQueue.tsx

"use client";
import { formatManilaDateTime24 } from '@/lib/clear-timezone';
import { clearAlert, clearConfirm, clearPrompt } from "@/lib/clear-dialogs";


import { useState } from "react";
import { useRouter } from "next/navigation";
import { fmt } from "@/lib/utils";
import { ThemedAlert } from "@/lib/clear-dialogs";
import { verifyOnlineRemittance, invalidateOnlineRemittance } from "./actions";
import { executeVoidTransaction } from "../void/actions";

interface OnlineRemittanceItem {
  id: string;
  timestamp: string;
  studentId: string;
  studentName: string;
  paymentChannel: string;
  referenceNumber: string;
  itemDescription: string | null;
  amountPaid: number;
  proofUrl: string | null;
  status: string | null;
  orNumber?: string | null;
}

interface Fund {
  id: string;
  fundName: string;
}

export default function RemittanceVerificationQueue({
  department,
  ay,
  term,
  remittances,
  funds,
  closed = false,
  canVoid = false,
}: {
  department: string;
  ay: string;
  term: string;
  remittances: OnlineRemittanceItem[];
  funds: Fund[];
  closed?: boolean;
  canVoid?: boolean;
}) {
  const router = useRouter();
  const [filterStatus, setFilterStatus] = useState("Pending");
  const [activeProof, setActiveProof] = useState<{ url: string; name: string } | null>(null);
  
  const [verifyingItem, setVerifyingItem] = useState<OnlineRemittanceItem | null>(null);
  const [fundAllocation, setFundAllocation] = useState(funds[0]?.fundName || "General Fund (Carried Over)");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const voidVerifiedRemittance = async (item: OnlineRemittanceItem) => {
    if (!canVoid || closed || !item.orNumber || voidingId) return;
    const reason = await clearPrompt(`Explain why approved remittance ${item.referenceNumber} (OR ${item.orNumber}) must be reversed.`,
      { title: "Void Approved Remittance", multiline: true, confirmText: "Continue" });
    if (reason === null) return;
    if (reason.trim().length < 5) return void clearAlert("A reason of at least 5 characters is required.");
    const approved = await clearConfirm(`Void OR ${item.orNumber}, reverse its receipts and restore linked student dues? Original remittance proof is retained.`,
      { title: "Confirm Financial Reversal", confirmText: "Void Approved Remittance" });
    if (!approved) return;
    setVoidingId(item.id);
    try {
      await executeVoidTransaction({ department, category: "collections", referenceId: item.orNumber,
        ay, term, reason: reason.trim() });
      await clearAlert("Approved remittance and linked OR reversed. The original proof and audit trail were retained.", "success");
      router.refresh();
    } catch (error: any) {
      await clearAlert(error?.message || "Remittance reversal failed.", "error");
    } finally { setVoidingId(null); }
  };

  const filteredRemittances = remittances.filter(r => {
    const st = r.status || 'Pending';
    if (filterStatus === "Pending") return st === "Pending Verification" || st === "Pending";
    if (filterStatus === "Verified") return st === "Verified";
    if (filterStatus === "Rejected") return st === "Rejected";
    return true;
  });

  const handleOpenVerify = (item: OnlineRemittanceItem) => {
    setVerifyingItem(item);
    setFundAllocation(funds[0]?.fundName || "General Fund (Carried Over)");
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyingItem) return;
    if (closed) return void clearAlert("This accounting term is closed by a rollover.");

    setIsSubmitting(true);
    try {
      const result = await verifyOnlineRemittance(department, {
        remittanceId: verifyingItem.id,
        studentId: verifyingItem.studentId,
        studentName: verifyingItem.studentName,
        particulars: verifyingItem.itemDescription || "Online Payment",
        amount: verifyingItem.amountPaid,
        ay,
        term,
        fundAllocation
      });

      await ThemedAlert.fire({
        icon: 'success',
        title: 'Remittance Verified',
        text: `Remittance verified successfully! Official Receipt #${result.orNumber} issued.`
      });

      setVerifyingItem(null);
      router.refresh();
    } catch (err: any) {
      await ThemedAlert.fire({
        icon: 'error',
        title: 'Verification Failed',
        text: err?.message || 'Failed to verify online remittance.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInvalidate = async (id: string, refNo: string) => {
    const result = await ThemedAlert.fire({
      icon: 'warning',
      title: 'Reject Remittance?',
      text: `Are you sure you want to mark reference #${refNo} as INVALID? It will be moved to the Rejected tab.`,
      showCancelButton: true,
      confirmButtonText: 'Yes, Reject',
      cancelButtonText: 'Cancel'
    });

    if (!result.isConfirmed) return;

    try {
      await invalidateOnlineRemittance(department, id);
      router.refresh();
      await ThemedAlert.fire({
        icon: 'success',
        title: 'Rejected',
        text: 'Submission successfully rejected.'
      });
    } catch (err: any) {
      await ThemedAlert.fire({
        icon: 'error',
        title: 'Action Failed',
        text: err?.message || 'Failed to invalidate remittance.'
      });
    }
  };

  return (
    <div>
      {closed && <div className="alert alert-warning">This term was carried forward. New verifications are disabled; existing records remain visible.</div>}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <select 
          className="form-select form-select-sm bg-body-secondary text-body border-secondary fw-semibold" 
          style={{ width: '220px' }}
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="Pending">Pending Verification Only</option>
          <option value="Verified">Verified Only</option>
          <option value="Rejected">Rejected Only</option>
          <option value="All">All Records</option>
        </select>

        <button className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1 fw-bold" onClick={() => window.location.reload()}>
          <i className="bi bi-arrow-clockwise"></i> Refresh
        </button>
      </div>

      <div className="table-responsive mb-4">
        <table className="table table-hover align-middle text-body border-secondary">
          <thead>
            <tr className="text-muted small border-bottom border-secondary">
              <th>Submitted</th>
              <th>Student</th>
              <th>Channel</th>
              <th>Reference #</th>
              <th>Particulars</th>
              <th className="text-end">Amount</th>
              <th className="text-center">Proof</th>
              <th>Status</th>
              <th className="text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredRemittances.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center text-muted py-5">
                  <i className="bi bi-inbox fs-2 d-block mb-2 opacity-50"></i>
                  No remittance records matching selected filter.
                </td>
              </tr>
            ) : (
              filteredRemittances.map(r => (
                <tr key={r.id} className="border-bottom border-secondary">
                  <td className="small text-muted">{formatManilaDateTime24(r.timestamp)}</td>
                  <td><strong className="fw-semibold">{r.studentName}</strong> <br /><small className="text-muted">({r.studentId})</small></td>
                  <td><span className="badge bg-body-secondary border border-secondary text-info">{r.paymentChannel}</span></td>
                  <td><strong className="font-monospace">{r.referenceNumber}</strong></td>
                  <td className="small">{r.itemDescription || '—'}</td>
                  <td className="text-end fw-bold text-success">{fmt(r.amountPaid as any)}</td>
                  <td className="text-center">
                    {r.proofUrl ? (
                      <button className="btn btn-outline-info btn-sm py-0 fw-semibold" onClick={() => setActiveProof({ url: r.proofUrl!, name: `${r.referenceNumber}_proof` })}>
                        <i className="bi bi-image"></i> View
                      </button>
                    ) : (
                      <span className="text-muted small">No Proof</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${r.status === 'Verified' ? 'bg-success' : r.status === 'Rejected' ? 'bg-danger' : 'bg-warning text-dark'}`}>
                      {r.status === 'Pending Verification' ? 'Pending' : (r.status || 'Pending')}
                    </span>
                  </td>
                  <td className="text-center">
                    {r.status === "Verified" && canVoid && !closed && Boolean(r.orNumber) && (
                      <button type="button" className="btn btn-sm btn-outline-danger fw-semibold"
                        disabled={Boolean(voidingId)} onClick={() => voidVerifiedRemittance(r)}>
                        {voidingId === r.id ? "Voiding..." : "Void Approval"}
                      </button>
                    )}
                    {(!r.status || r.status.includes('Pending')) && (
                      <div className="d-flex gap-1 justify-content-center">
                        <button className="btn btn-success btn-sm py-0 fw-bold text-dark" onClick={() => handleOpenVerify(r)}>
                          Verify
                        </button>
                        <button className="btn btn-outline-danger btn-sm py-0 fw-bold" onClick={() => handleInvalidate(r.id, r.referenceNumber)}>
                          Reject
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {activeProof && (
        <div className="modal fade show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content bg-body text-body border-secondary shadow-lg clear-theme-modal">
              <div className="modal-header border-secondary">
                <h5 className="modal-title fw-bold text-info"><i className="bi bi-receipt me-2"></i>Payment Proof Inspection</h5>
                <button type="button" className="btn-close" onClick={() => setActiveProof(null)}></button>
              </div>
              <div className="modal-body text-center p-3 bg-body-secondary">
                <img src={activeProof.url} alt="Payment Proof" className="img-fluid rounded border border-secondary shadow-sm" style={{ maxHeight: '70vh' }} />
              </div>
              <div className="modal-footer border-secondary">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setActiveProof(null)}>Close Viewer</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {verifyingItem && (
        <div className="modal fade show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content bg-body text-body border-secondary shadow-lg clear-theme-modal">
              <div className="modal-header border-secondary">
                <h5 className="modal-title text-success fw-bold"><i className="bi bi-check-circle-fill me-2"></i>Verify Online Payment</h5>
                <button type="button" className="btn-close" onClick={() => setVerifyingItem(null)}></button>
              </div>
              <form onSubmit={handleVerifySubmit}>
                <div className="modal-body">
                  
                  <div className="mb-2">
                    <label className="form-label text-muted small fw-semibold">Student</label>
                    <input type="text" className="form-control text-body bg-body-secondary border-secondary" value={`${verifyingItem.studentName} (${verifyingItem.studentId})`} readOnly />
                  </div>
                  
                  <div className="row g-2 mb-2">
                    <div className="col-6">
                      <label className="form-label text-muted small fw-semibold">Channel & Ref #</label>
                      <input type="text" className="form-control text-body bg-body-secondary border-secondary" value={`${verifyingItem.paymentChannel} — ${verifyingItem.referenceNumber}`} readOnly />
                    </div>
                    <div className="col-6">
                      <label className="form-label text-muted small fw-semibold">Amount Paid</label>
                      <input type="text" className="form-control bg-body-secondary border-secondary fw-bold text-success" value={fmt(verifyingItem.amountPaid as any)} readOnly />
                    </div>
                  </div>
                  
                  <div className="mb-3">
                    <label className="form-label text-muted small fw-semibold">Particulars / Fee</label>
                    <input type="text" className="form-control text-body bg-body-secondary border-secondary" value={verifyingItem.itemDescription || '—'} readOnly />
                  </div>

                  <hr className="border-secondary opacity-50" />

                  <div className="mb-3">
                    <label className="form-label text-muted small fw-semibold">Official Receipt (OR) Number</label>
                    <div className="form-control bg-body-secondary text-body">Automatically issued after verification</div>
                  </div>

                  <div className="mb-2">
                    <label className="form-label text-muted small fw-semibold">Target Fund Allocation</label>
                    <select 
                      className="form-select bg-body text-body border-secondary" 
                      value={fundAllocation} 
                      onChange={e => setFundAllocation(e.target.value)}
                    >
                      {funds.map(f => <option key={f.id} value={f.fundName}>{f.fundName}</option>)}
                      <option value="General Fund (Carried Over)">General Fund (Carried Over)</option>
                    </select>
                    <div className="form-text small opacity-75">Select the fund pool where this payment should be deposited.</div>
                  </div>
                  
                </div>
                <div className="modal-footer border-secondary bg-body-secondary">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setVerifyingItem(null)}>Cancel</button>
                  <button type="submit" className="btn btn-success btn-sm fw-bold text-dark" disabled={isSubmitting || closed}>
                    {isSubmitting ? "Issuing OR..." : "Confirm & Issue Official Receipt"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}