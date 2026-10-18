// /app/department/[department]/(protected)/void/VoidClient.tsx

"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { executeVoidTransaction } from "./actions";
import { ThemedAlert } from '@/lib/clear-dialogs';

export default function VoidClient({ 
  initialRecords, 
  department, 
  category,
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  query,
  ay,
  term,
}: { 
  initialRecords: any[]; 
  department: string; 
  category: string; 
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  query: string;
  ay: string;
  term: string;
}) {
  const [records, setRecords] = useState(initialRecords);
  const [searchText, setSearchText] = useState(query);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingVoid, setPendingVoid] = useState<{ refId: string; amount: number; particulars: string } | null>(null);
  const [reason, setReason] = useState("");
  const [validationMessage, setValidationMessage] = useState("");
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    setRecords(initialRecords);
  }, [initialRecords]);

  useEffect(() => { setSearchText(query); }, [query]);

  const buildUrl = (categoryName: string, pageNumber: number, text = query, size = pageSize) => {
    const params = new URLSearchParams({ category: categoryName, page: String(pageNumber),
      pageSize: String(size), ay, term });
    if (text.trim()) params.set('q', text.trim().slice(0, 100));
    return `${pathname}?${params.toString()}`;
  };

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    router.push(buildUrl(category, 1, searchText));
  };

  const clearSearch = () => {
    setSearchText('');
    router.push(buildUrl(category, 1, ''));
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSearchText('');
    router.push(buildUrl(e.target.value, 1, ''));
  };

  const handlePageChange = (newPage: number) => {
    router.push(buildUrl(category, newPage));
  };

  const handleVoidClick = (refId: string, amount: number, particulars: string) => {
    if (isProcessing) return;
    setPendingVoid({ refId, amount, particulars });
    setReason("");
    setValidationMessage("");
  };

  const submitVoid = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!pendingVoid || isProcessing) return;
    const { refId, amount, particulars } = pendingVoid;
    const explanation = reason.trim();
    if (explanation.length < 5) {
      setValidationMessage("Provide a specific reason of at least 5 characters.");
      return;
    }
    if (explanation.length > 500) {
      setValidationMessage("Reason must be 500 characters or less.");
      return;
    }
    // Close the CLEAR-styled dialog before opening any follow-up confirmation.
    setPendingVoid(null);
    setValidationMessage("");
    const isLegacyPenaltyReceipt = category === "collections" &&
      /^Penalty Fine\s*:\s*\S/i.test(particulars);
    let legacyPenaltyId = "";
    if (isLegacyPenaltyReceipt) {
      const referenceResult = await ThemedAlert.fire({
        icon: "warning",
        title: "Link Historical Penalty Receipt",
        text: "This old receipt lacks a unique penalty reference. Enter the exact PEN- reference. Only an administrator can reverse historical receipts; the server verifies student, activity and term.",
        input: "text",
        inputPlaceholder: "PEN-...",
        showCancelButton: true,
        confirmButtonText: "Verify Penalty Link",
      });
      if (!referenceResult.isConfirmed) return;
      legacyPenaltyId = String(referenceResult.value || "").trim();
      if (!legacyPenaltyId) return;
    }


    const confirmResult = await ThemedAlert.fire({
      icon: 'warning',
      title: 'Confirm Reversal',
      text: category === "collections"
        ? `Void receipt ${refId} and ALL its allocated fund lines? Linked penalty payments will also restore the corresponding unpaid penalty balance. This is an accounting reversal, not evidence of a physical cash refund.\nReason: ${explanation}`
        : `Permanently VOID and REVERSE ${refId}?\nReason: ${explanation}`,
      showCancelButton: true,
      confirmButtonText: 'Yes, Permanently Void',
      confirmButtonColor: '#dc3545'
    });

    if (!confirmResult.isConfirmed) return;

    setIsProcessing(true);
    try {
      const res = await executeVoidTransaction({
        department,
        category,
        referenceId: refId,
        ay,
        term,
        legacyPenaltyId: legacyPenaltyId || undefined,
        reason: explanation
      });

      if (res.success) {
        setRecords(prev => prev.filter(r => r.refId !== refId));
        // Never leave a previous student/receipt search selected after a successful reversal.
        setSearchText('');
        router.replace(buildUrl(category, 1, ''));
        router.refresh();
        await ThemedAlert.fire({
          icon: 'success',
          title: 'Successfully Voided',
          text: res.message
        });
      }
    } catch (err: any) {
      await ThemedAlert.fire({
        icon: 'error',
        title: 'Void Failed',
        text: err.message || "Failed to execute transaction reversal."
      });
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

      <div className="card p-3 border-secondary bg-surface mb-4">
        <div className="row g-3 align-items-end">
          <div className="col-md-5">
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
          <div className="col-md-7">
            <form onSubmit={handleSearch} role="search">
              <label htmlFor="void-search" className="form-label text-secondary small fw-semibold">Search Student / Requestor / Reference</label>
              <div className="input-group">
                <input id="void-search" type="search" value={searchText} maxLength={100}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Student name or ID, OR, fee or reference" className="form-control bg-card text-color border-secondary" />
                <button type="submit" className="btn btn-info fw-semibold">Search</button>
                <button type="button" className="btn btn-outline-secondary" onClick={clearSearch}
                  disabled={!searchText && !query}>Clear</button>
              </div>
            </form>
          </div>
        </div>
      </div>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
        <span className="small text-secondary">{totalCount} matching record{totalCount === 1 ? '' : 's'} · {term} ({ay})</span>
        <label className="d-flex align-items-center gap-2 small text-secondary">
          Rows per page
          <select className="form-select form-select-sm bg-card text-color border-secondary" style={{ width: 'auto' }}
            aria-label="Rows per page" value={pageSize} onChange={(e) => router.push(buildUrl(category, 1, query, Number(e.target.value)))}>
            {[10,25,50,100].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>

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
                  <td className="text-end fw-bold text-danger">₱{Number(r.amount || 0).toFixed(2)}</td>
                  <td className="small text-muted">{r.extra}</td>
                  <td className="text-end">
                    <button 
                      className="btn btn-danger btn-sm px-3 fw-bold" 
                      onClick={() => handleVoidClick(r.refId, r.amount, String(r.particulars || ""))}
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
                  No matching records for this category and search. Clear the search or select another period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

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
      {pendingVoid && (
        <div className="modal fade show d-block" role="presentation" style={{ backgroundColor: "rgba(0,0,0,0.72)", zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered" role="dialog" aria-modal="true" aria-labelledby="clear-void-modal-heading">
            <form className="modal-content bg-body text-body border border-secondary shadow-lg clear-theme-modal" onSubmit={submitVoid}>
              <div className="modal-header border-secondary">
                <h5 id="clear-void-modal-heading" className="modal-title fw-bold text-danger">
                  <i className="bi bi-exclamation-octagon me-2" />Void Transaction {pendingVoid.refId}
                </h5>
                <button type="button" className="btn-close" aria-label="Close" onClick={() => setPendingVoid(null)} />
              </div>
              <div className="modal-body">
                <p className="mb-3">Enter the mandatory reason for reversing <strong>{pendingVoid.refId}</strong> ({`₱${pendingVoid.amount.toFixed(2)}`}).</p>
                <label className="form-label fw-semibold" htmlFor="clear-void-reason">Reason / Justification <span className="text-danger">*</span></label>
                <textarea id="clear-void-reason" className={`form-control bg-body text-body border-secondary ${validationMessage ? 'is-invalid' : ''}`}
                  value={reason} maxLength={500} rows={4} placeholder="Describe why the transaction needs to be reversed..." required autoFocus
                  onChange={event => { setReason(event.target.value); setValidationMessage(""); }} />
                {validationMessage && <div className="invalid-feedback d-block">{validationMessage}</div>}
                <div className="form-text text-muted">This action retains the original transaction and records an audit trail. A separate confirmation follows.</div>
              </div>
              <div className="modal-footer border-secondary">
                <button type="button" className="btn btn-outline-secondary" onClick={() => setPendingVoid(null)}>Cancel</button>
                <button type="submit" className="btn btn-danger fw-bold" disabled={reason.trim().length < 5}>Review Reversal</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}