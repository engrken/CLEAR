// /(protected)/remittances/RemittanceManager.tsx

"use client";

import { useState, useMemo } from "react";
import { fmt } from "@/lib/utils";
import { format } from "date-fns";
import { submitRemittanceBatch } from "./actions";

interface CollectionItem {
  id: string;
  orNumber: string;
  date: string; // Serialized Date from Server
  studentId: string;
  studentName: string;
  category: string;
  itemDescription: string;
  amountPaid: number;
  status: string | null;
}

export default function RemittanceManager({
  department,
  ay,
  term,
  unremittedItems,
  remittedItems
}: {
  department: string;
  ay: string;
  term: string;
  unremittedItems: CollectionItem[];
  remittedItems: CollectionItem[];
}) {
  const todayStr = new Date().toISOString().split('T')[0];

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [depositSlipOr, setDepositSlipOr] = useState("");
  const [remitDate, setRemitDate] = useState(todayStr);
  const [depositedBy, setDepositedBy] = useState("");
  const [remarks, setRemarks] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Toggle single item selection
  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  // Toggle select all unremitted items
  const toggleSelectAll = () => {
    if (selectedIds.length === unremittedItems.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(unremittedItems.map(i => i.id));
    }
  };

  // Compute total selected amount
  const totalSelectedAmount = useMemo(() => {
    return unremittedItems
      .filter(i => selectedIds.includes(i.id))
      .reduce((sum, i) => sum + (Number(i.amountPaid) || 0), 0);
  }, [selectedIds, unremittedItems]);

  // Submit Remittance Batch
  const handleSubmitRemittance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0) return alert("Please select at least one collection item to remit.");
    if (!depositSlipOr.trim()) return alert("Please enter the University Treasury OR or Deposit Slip number.");

    setIsSubmitting(true);
    try {
      await submitRemittanceBatch(department, {
        collectionIds: selectedIds,
        depositSlipOr: depositSlipOr.trim(),
        remitDate,
        depositedBy: depositedBy.trim() || "Authorized Officer",
        remarks: remarks.trim() || "Regular treasury remittance",
        ay,
        term
      });

      alert(`Successfully remitted ${selectedIds.length} items totaling ${fmt(totalSelectedAmount as any)} under Slip #${depositSlipOr.trim()}`);
      setSelectedIds([]);
      setDepositSlipOr("");
      setRemarks("");
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmitRemittance} className="mb-4">
        {/* Remittance Details Card */}
        <div className="card p-3 border-secondary bg-body-secondary mb-3 shadow-sm text-body">
          <h6 className="text-success fw-bold mb-3"><i className="bi bi-bank me-2"></i>Remit Selected to University Cashier</h6>
          
          <div className="row g-2 mb-2">
            <div className="col-md-4">
              <label className="form-label text-muted small fw-semibold">Remittance Date</label>
              <input type="date" className="form-control bg-body text-body border-secondary" value={remitDate} onChange={e => setRemitDate(e.target.value)} required />
            </div>
            <div className="col-md-4">
              <label className="form-label text-muted small fw-semibold">Treasury OR / Deposit Slip #</label>
              <input type="text" className="form-control font-monospace bg-body text-body border-secondary" placeholder="e.g. UCR-2026-9812" value={depositSlipOr} onChange={e => setDepositSlipOr(e.target.value)} required />
            </div>
            <div className="col-md-4">
              <label className="form-label text-muted small fw-semibold">Deposited By (Officer)</label>
              <input type="text" className="form-control bg-body text-body border-secondary" placeholder="Full Name" value={depositedBy} onChange={e => setDepositedBy(e.target.value)} required />
            </div>
          </div>

          <div className="mb-3">
            <label className="form-label text-muted small fw-semibold">Remarks / Notes</label>
            <input type="text" className="form-control bg-body text-body border-secondary" placeholder="e.g. Batch remittance for 1st Sem collections" value={remarks} onChange={e => setRemarks(e.target.value)} />
          </div>

          <div className="d-flex justify-content-between align-items-center p-2 rounded bg-body border border-secondary mb-3">
            <span className="small text-muted">Selected Items: <strong className="text-body">{selectedIds.length}</strong></span>
            <span className="small text-muted">Total Deposit Amount: <strong className="text-success fs-6 fw-bold">{fmt(totalSelectedAmount as any)}</strong></span>
          </div>

          <button type="submit" className="btn btn-success fw-bold text-dark w-100 py-2" disabled={isSubmitting || selectedIds.length === 0}>
            {isSubmitting ? "Processing Remittance..." : "Submit Remittance to Treasury"}
          </button>
        </div>
      </form>

      {/* Unremitted Queue Table */}
      <h6 className="fw-bold text-info mb-2">Pending Unremitted Collections ({unremittedItems.length})</h6>
      <div className="table-responsive mb-5">
        <table className="table table-hover align-middle text-body border-secondary">
          <thead>
            <tr className="text-muted small border-bottom border-secondary">
              <th className="text-center" style={{ width: '40px' }}>
                <input type="checkbox" className="form-check-input border-secondary" checked={unremittedItems.length > 0 && selectedIds.length === unremittedItems.length} onChange={toggleSelectAll} />
              </th>
              <th>OR #</th>
              <th>Date</th>
              <th>Student</th>
              <th>Item / Category</th>
              <th className="text-end">Amount</th>
            </tr>
          </thead>
          <tbody>
            {unremittedItems.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-muted py-3">All collections for this term have been remitted.</td></tr>
            ) : (
              unremittedItems.map(item => (
                <tr key={item.id} className="border-bottom border-secondary">
                  <td className="text-center">
                    <input type="checkbox" className="form-check-input border-secondary" checked={selectedIds.includes(item.id)} onChange={() => toggleSelect(item.id)} />
                  </td>
                  <td><strong className="font-monospace text-info">{item.orNumber}</strong></td>
                  <td className="small text-muted">{format(new Date(item.date), 'yyyy-MM-dd')}</td>
                  <td><span className="fw-semibold">{item.studentName}</span> <br/><small className="text-muted">({item.studentId})</small></td>
                  <td className="small">{item.itemDescription || item.category}</td>
                  <td className="text-end fw-bold text-success">{fmt(item.amountPaid as any)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Remitted History Table */}
      <h6 className="fw-bold text-secondary mb-2">Completed Remittance History ({remittedItems.length})</h6>
      <div className="table-responsive">
        <table className="table table-hover align-middle text-body border-secondary">
          <thead>
            <tr className="text-muted small border-bottom border-secondary">
              <th>OR / Slip #</th>
              <th>Date</th>
              <th>Student</th>
              <th>Item Description</th>
              <th className="text-end">Amount</th>
              <th className="text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {remittedItems.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-muted py-3">No completed remittances recorded yet.</td></tr>
            ) : (
              remittedItems.map(item => (
                <tr key={item.id} className="border-bottom border-secondary">
                  <td><strong className="font-monospace text-secondary">{item.orNumber}</strong></td>
                  <td className="small text-muted">{format(new Date(item.date), 'yyyy-MM-dd')}</td>
                  <td className="fw-semibold">{item.studentName}</td>
                  <td className="small">{item.itemDescription || item.category}</td>
                  <td className="text-end fw-bold text-success">{fmt(item.amountPaid as any)}</td>
                  <td className="text-center"><span className="badge bg-success text-white">{item.status}</span></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}