"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { executeVoidTransaction } from "./actions";
import { ThemedAlert } from '@/lib/alerts';

export default function VoidClient({ 
  initialRecords, 
  department, 
  category,
  currentPage,
  totalPages
}: { 
  initialRecords: any[]; 
  department: string; 
  category: string; 
  currentPage: number;
  totalPages: number;
}) {
  const [records, setRecords] = useState(initialRecords);
  const [isProcessing, setIsProcessing] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // FIX: Sync local records state whenever props update from category or page changes
  useEffect(() => {
    setRecords(initialRecords);
  }, [initialRecords]);

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCat = e.target.value;
    router.push(`${pathname}?category=${newCat}&page=1`);
  };

  const handlePageChange = (newPage: number) => {
    router.push(`${pathname}?category=${category}&page=${newPage}`);
  };

  const handleVoidClick = async (refId: string, amount: number) => {
    const reason = prompt(`Enter mandatory REASON for voiding ${refId} (₱${amount.toFixed(2)}):`);
    if (!reason || !reason.trim()) {
      alert("Void cancelled. A specific reason is required.");
      return;
    }

    if (!confirm(`Permanently VOID and REVERSE ${refId}?\n\nReason: ${reason.trim()}`)) return;

    let pin = undefined;
    const needsPin = confirm("Do you need to enter a Master Void Authorization PIN? (Click Cancel if logged in as Admin)");
    if (needsPin) {
      pin = prompt("Enter Master Void Authorization PIN:") || undefined;
      if (!pin) return alert("Void cancelled. Authorization PIN required.");
    }

    setIsProcessing(true);
    try {
      const res = await executeVoidTransaction({
        department,
        category,
        referenceId: refId,
        reason: reason.trim(),
        pin
      });

      if (res.success) {
        setRecords(prev => prev.filter(r => r.refId !== refId));
        alert(res.message);
      }
    } catch (err: any) {
      alert(err.message || "Failed to execute transaction reversal.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="card p-3 p-md-4 border-secondary shadow-sm bg-card text-color">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
        <div>
          <h5 className="text-danger mb-1 fw-bold">
            <i className="bi bi-slash-circle me-2"></i>Administrative Reversals & Void Center
          </h5>
          <p className="text-secondary small mb-0">
            Select a transaction category to inspect live records and authorize secure revocations.
          </p>
        </div>
        <button className="btn btn-outline-secondary btn-sm" onClick={() => window.location.reload()}>
          <i className="bi bi-arrow-repeat me-1"></i>Refresh
        </button>
      </div>

      {/* CATEGORY SELECTOR */}
      <div className="card p-3 border-secondary bg-surface mb-4">
        <div className="row g-3 align-items-end">
          <div className="col-md-12">
            <label className="form-label text-secondary small fw-semibold">Transaction Category</label>
            <select 
              value={category} 
              onChange={handleCategoryChange} 
              className="form-select bg-card text-color border-secondary"
            >
              <option value="collections">Official Payment Receipts (OR)</option>
              <option value="penalties">Logged Student Penalties</option>
              <option value="advances">Active Cash Advances</option>
              <option value="collectibles">Assessed Activity & Merchandise Dues</option>
            </select>
          </div>
        </div>
      </div>

      {/* RECORDS TABLE */}
      <div className="table-responsive">
        <table className="table table-hover align-middle text-color">
          <thead>
            <tr className="text-secondary small">
              <th>Date</th>
              <th>Reference ID</th>
              <th>Student / Requestor</th>
              <th>Particulars / Description</th>
              <th className="text-end">Amount</th>
              <th>Extra Details</th>
              <th className="text-end">Action</th>
            </tr>
          </thead>
          <tbody>
            {records.length > 0 ? (
              records.map((r) => (
                <tr key={r.id}>
                  <td className="small">{r.date}</td>
                  <td><strong>{r.refId}</strong></td>
                  <td><strong className="text-accent">{r.name}</strong></td>
                  <td className="small text-secondary">{r.particulars}</td>
                  <td className="text-end fw-bold text-danger">₱{r.amount.toFixed(2)}</td>
                  <td className="small text-muted">{r.extra}</td>
                  <td className="text-end">
                    <button 
                      className="btn btn-danger btn-sm px-3 fw-bold" 
                      onClick={() => handleVoidClick(r.refId, r.amount)}
                      disabled={isProcessing}
                    >
                      VOID
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="text-center text-secondary py-5">
                  No records found matching the selected category.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* PAGINATION CONTROLS */}
      {totalPages > 1 && (
        <div className="d-flex justify-content-between align-items-center mt-3 pt-3 border-top border-secondary">
          <small className="text-secondary">
            Page {currentPage} of {totalPages}
          </small>
          <div className="btn-group btn-group-sm">
            <button 
              className="btn btn-outline-secondary" 
              disabled={currentPage <= 1}
              onClick={() => handlePageChange(currentPage - 1)}
            >
              <i className="bi bi-chevron-left me-1"></i>Previous
            </button>
            <button 
              className="btn btn-outline-secondary" 
              disabled={currentPage >= totalPages}
              onClick={() => handlePageChange(currentPage + 1)}
            >
              Next<i className="bi bi-chevron-right ms-1"></i>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}