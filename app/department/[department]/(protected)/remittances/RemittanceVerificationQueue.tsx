"use client";

import { useState } from "react";
import { fmt } from "@/lib/utils";
import { format } from "date-fns";
import {
  verifyOnlineRemittance,
  invalidateOnlineRemittance
} from "./actions";
import { ThemedAlert } from '@/lib/alerts';

interface OnlineRemittanceItem {
  id: string;
  timestamp: Date;
  studentId: string;
  studentName: string;
  paymentChannel: string;
  referenceNumber: string;
  itemDescription: string | null;
  amountPaid: number;
  proofUrl: string | null;
  status: string | null;
}

export default function RemittanceVerificationQueue({
  department,
  ay,
  term,
  remittances,
  nextOr
}: {
  department: string;
  ay: string;
  term: string;
  remittances: OnlineRemittanceItem[];
  nextOr: string;
}) {
  const [filterStatus, setFilterStatus] = useState("Pending");
  const [activeProof, setActiveProof] = useState<{ url: string; name: string } | null>(null);
  
  const [verifyingItem, setVerifyingItem] = useState<OnlineRemittanceItem | null>(null);
  const [orNumber, setOrNumber] = useState(nextOr);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredRemittances = remittances.filter(r => {
    const st = r.status || 'Pending';
    if (filterStatus === "Pending") return st === "Pending";
    if (filterStatus === "Verified") return st === "Verified";
    if (filterStatus === "Rejected") return st === "Rejected";
    return true;
  });

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyingItem) return;

    setIsSubmitting(true);
    try {
      await verifyOnlineRemittance(department, {
        remittanceId: verifyingItem.id,
        orNumber,
        studentId: verifyingItem.studentId,
        studentName: verifyingItem.studentName,
        particulars: verifyingItem.itemDescription || "Online Payment",
        amount: verifyingItem.amountPaid,
        ay,
        term
      });

      alert(`Remittance verified successfully! Official Receipt #${orNumber} issued.`);
      setVerifyingItem(null);
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInvalidate = async (id: string, refNo: string) => {
    if (!confirm(`Are you sure you want to mark reference #${refNo} as INVALID and remove it from the queue?`)) return;

    try {
      await invalidateOnlineRemittance(department, id);
      alert("Submission successfully removed.");
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <select 
          className="form-select form-select-sm bg-card text-color border-secondary" 
          style={{ width: '220px' }}
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="Pending">Pending Verification Only</option>
          <option value="Verified">Verified Only</option>
          <option value="Rejected">Rejected Only</option>
          <option value="All">All Records</option>
        </select>

        <button className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1" onClick={() => window.location.reload()}>
          <i className="bi bi-arrow-clockwise"></i> Refresh
        </button>
      </div>

      <div className="table-responsive">
        <table className="table table-hover align-middle">
          <thead>
            <tr className="text-secondary small">
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
                <td colSpan={9} className="text-center text-secondary py-5">
                  No remittance records matching selected filter.
                </td>
              </tr>
            ) : (
              filteredRemittances.map(r => (
                <tr key={r.id}>
                  <td className="small text-secondary">{format(new Date(r.timestamp), 'yyyy-MM-dd HH:mm')}</td>
                  <td><strong>{r.studentName}</strong> <br /><small className="text-secondary">({r.studentId})</small></td>
                  <td><span className="badge border border-secondary text-info">{r.paymentChannel}</span></td>
                  <td><strong className="font-monospace">{r.referenceNumber}</strong></td>
                  <td>{r.itemDescription || '—'}</td>
                  <td className="text-end fw-bold text-success">{fmt(r.amountPaid)}</td>
                  <td className="text-center">
                    {r.proofUrl ? (
                      <button className="btn btn-outline-info btn-sm py-0" onClick={() => setActiveProof({ url: r.proofUrl!, name: `${r.referenceNumber}_proof` })}>
                        <i className="bi bi-image"></i> View
                      </button>
                    ) : (
                      <span className="text-secondary small">No Proof</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${r.status === 'Verified' ? 'bg-success' : r.status === 'Rejected' ? 'bg-danger' : 'bg-warning text-dark'}`}>
                      {r.status || 'Pending'}
                    </span>
                  </td>
                  <td className="text-center">
                    {(!r.status || r.status === 'Pending') && (
                      <div className="d-flex gap-1 justify-content-center">
                        <button className="btn btn-success btn-sm py-0 fw-bold" onClick={() => setVerifyingItem(r)}>
                          Verify
                        </button>
                        <button className="btn btn-outline-danger btn-sm py-0 fw-bold" onClick={() => handleInvalidate(r.id, r.referenceNumber)}>
                          Invalid
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
            <div className="modal-content card border-secondary bg-dark text-white">
              <div className="modal-header border-secondary">
                <h5 className="modal-title"><i className="bi bi-receipt me-2"></i>Payment Proof Inspection</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setActiveProof(null)}></button>
              </div>
              <div className="modal-body text-center bg-black p-3">
                <img src={activeProof.url} alt="Payment Proof" className="img-fluid rounded" style={{ maxHeight: '70vh' }} />
              </div>
              <div className="modal-footer border-secondary">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setActiveProof(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {verifyingItem && (
        <div className="modal fade show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content card border-secondary bg-dark text-white">
              <div className="modal-header border-secondary">
                <h5 className="modal-title text-success"><i className="bi bi-check-circle me-2"></i>Verify Online Payment</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setVerifyingItem(null)}></button>
              </div>
              <form onSubmit={handleVerifySubmit}>
                <div className="modal-body">
                  <div className="mb-2">
                    <label className="form-label text-secondary small fw-semibold">Student</label>
                    <input type="text" className="form-control text-secondary bg-card" value={`${verifyingItem.studentName} (${verifyingItem.studentId})`} readOnly />
                  </div>
                  <div className="row g-2 mb-2">
                    <div className="col-6">
                      <label className="form-label text-secondary small fw-semibold">Channel & Ref #</label>
                      <input type="text" className="form-control text-secondary bg-card" value={`${verifyingItem.paymentChannel} — ${verifyingItem.referenceNumber}`} readOnly />
                    </div>
                    <div className="col-6">
                      <label className="form-label text-secondary small fw-semibold">Amount Paid</label>
                      <input type="text" className="form-control text-secondary bg-card fw-bold text-success" value={fmt(verifyingItem.amountPaid)} readOnly />
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label text-secondary small fw-semibold">Particulars / Fee</label>
                    <input type="text" className="form-control text-secondary bg-card" value={verifyingItem.itemDescription || '—'} readOnly />
                  </div>

                  <div className="mb-3">
                    <label className="form-label text-secondary small fw-semibold">Assign Official Receipt (OR) Number</label>
                    <input type="text" className="form-control font-monospace" value={orNumber} onChange={e => setOrNumber(e.target.value)} required />
                  </div>
                </div>
                <div className="modal-footer border-secondary">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setVerifyingItem(null)}>Cancel</button>
                  <button type="submit" className="btn btn-success btn-sm fw-bold" disabled={isSubmitting}>
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