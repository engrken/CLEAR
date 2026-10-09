"use client";

import { useState, useMemo } from "react";
import { fmt } from "@/lib/utils";
import { format } from "date-fns";
import { submitRemittanceBatch } from "./actions";
import { ThemedAlert } from '@/lib/alerts';

interface CollectionItem {
  id: string;
  orNumber: string;
  date: Date;
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

      alert(`Successfully remitted ${selectedIds.length} items totaling ${fmt(totalSelectedAmount)} under Slip #${depositSlipOr.trim()}`);
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
        <div className="card p-3 border-secondary bg-card mb-3 shadow-sm">
          <h6 className="text-success fw-bold mb-3"><i className="bi bi-bank me-2"></i>Remit Selected to University Cashier</h6>
          
          <div className="row g-2 mb-2">
            <div className="col-md-4">
              <label className="form-label text-secondary small fw-semibold">Remittance Date</label>
              <input type="date" className="form-control" value={remitDate} onChange={e => setRemitDate(e.target.value)} required />
            </div>
            <div className="col-md-4">
              <label className="form-label text-secondary small fw-semibold">Treasury OR / Deposit Slip #</label>
              <input type="text" className="form-control font-monospace" placeholder="e.g. UCR-2026-9812" value={depositSlipOr} onChange={e => setDepositSlipOr(e.target.value)} required />
            </div>
            <div className="col-md-4">
              <label className="form-label text-secondary small fw-semibold">Deposited By (Officer)</label>
              <input type="text" className="form-control" placeholder="Full Name" value={depositedBy} onChange={e => setDepositedBy(e.target.value)} required />
            </div>
          </div>

          <div className="mb-3">
            <label className="form-label text-secondary small fw-semibold">Remarks / Notes</label>
            <input type="text" className="form-control" placeholder="e.g. Batch remittance for 1st Sem collections" value={remarks} onChange={e => setRemarks(e.target.value)} />
          </div>

          <div className="d-flex justify-content-between align-items-center p-2 rounded bg-body border border-secondary mb-3">
            <span className="small text-secondary">Selected Items: <strong>{selectedIds.length}</strong></span>
            <span className="small text-secondary">Total Deposit Amount: <strong className="text-success fs-6">{fmt(totalSelectedAmount)}</strong></span>
          </div>

          <button type="submit" className="btn btn-success fw-bold w-100" disabled={isSubmitting || selectedIds.length === 0}>
            {isSubmitting ? "Processing Remittance..." : "Submit Remittance to Treasury"}
          </button>
        </div>
      </form>

      {/* Unremitted Queue Table */}
      <h6 className="fw-bold text-secondary mb-2">Pending Unremitted Collections ({unremittedItems.length})</h6>
      <div className="table-responsive mb-4">
        <table className="table table-hover align-middle">
          <thead>
            <tr className="text-secondary small">
              <th className="text-center" style={{ width: '40px' }}>
                <input type="checkbox" className="form-check-input" checked={unremittedItems.length > 0 && selectedIds.length === unremittedItems.length} onChange={toggleSelectAll} />
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
              <tr><td colSpan={6} className="text-center text-secondary py-3">All collections for this term have been remitted.</td></tr>
            ) : (
              unremittedItems.map(item => (
                <tr key={item.id}>
                  <td className="text-center">
                    <input type="checkbox" className="form-check-input" checked={selectedIds.includes(item.id)} onChange={() => toggleSelect(item.id)} />
                  </td>
                  <td><strong className="font-monospace text-info">{item.orNumber}</strong></td>
                  <td>{format(new Date(item.date), 'yyyy-MM-dd')}</td>
                  <td>{item.studentName} <small className="text-secondary">({item.studentId})</small></td>
                  <td>{item.itemDescription || item.category}</td>
                  <td className="text-end fw-bold text-success">{fmt(item.amountPaid)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Remitted History Table */}
      <h6 className="fw-bold text-secondary mb-2">Completed Remittance History ({remittedItems.length})</h6>
      <div className="table-responsive">
        <table className="table table-hover align-middle">
          <thead>
            <tr className="text-secondary small">
              <th>OR / Slip #</th>
              <th>Date</th>
              <th>Student</th>
              <th>Item Description</th>
              <th className="text-end">Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {remittedItems.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-secondary py-3">No completed remittances recorded yet.</td></tr>
            ) : (
              remittedItems.map(item => (
                <tr key={item.id}>
                  <td><strong className="font-monospace text-secondary">{item.orNumber}</strong></td>
                  <td>{format(new Date(item.date), 'yyyy-MM-dd')}</td>
                  <td>{item.studentName}</td>
                  <td>{item.itemDescription || item.category}</td>
                  <td className="text-end fw-bold text-success">{fmt(item.amountPaid)}</td>
                  <td><span className="badge bg-success">{item.status}</span></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}