// /app/department/[department]/(protected)/liquidations/LiquidationsForm.tsx

"use client";
import { clearAlert, clearConfirm, clearPrompt } from "@/lib/clear-dialogs";


import { useState, useMemo, useEffect } from "react";
import { fmt } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { recordAudit } from "./actions";

interface CashAdvance { 
  id: string; 
  advanceId: string; 
  requestor: string; 
  fundSource: string; 
  amountApproved: number; 
}
interface Fund { 
  id: string; 
  fundName: string; 
}
interface ExpenseRow { 
  id: string; 
  qty: number; 
  orsi: string; 
  desc: string; 
  subTotal: number; 
  proofBase64?: string;
  proofMime?: string;
  fileName?: string;
}

export default function LiquidationsForm({
  department,
  ay,
  term,
  pendingAdvances,
  funds,
  prefillCaId,
  isClosed = false,
}: {
  department: string;
  ay: string;
  term: string;
  pendingAdvances: CashAdvance[];
  funds: Fund[];
  prefillCaId: string;
  isClosed?: boolean;
}) {
  const router = useRouter();
  const todayStr = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

  const [date, setDate] = useState(todayStr);
  const [selectedCaRef, setSelectedCaRef] = useState(prefillCaId || "");
  const [requestor, setRequestor] = useState("");
  const [fundSource, setFundSource] = useState(funds[0]?.fundName || "General Fund (Carried Over)");
  const [budgetRequested, setBudgetRequested] = useState<number>(0);
  
  const [expenseRows, setExpenseRows] = useState<ExpenseRow[]>([
    { id: "1", qty: 1, orsi: "", desc: "", subTotal: 0 }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fare Modal State
  const [showFareModal, setShowFareModal] = useState(false);
  const [fareMode, setFareMode] = useState("Tricycle");
  const [fareOrigin, setFareOrigin] = useState("");
  const [fareDestination, setFareDestination] = useState("");
  const [farePassengers, setFarePassengers] = useState(1);
  const [fareRate, setFareRate] = useState<number>(0);

  const computedFareTotal = farePassengers * fareRate;

  // Sync CA details when reference dropdown changes
  useEffect(() => {
    if (selectedCaRef === "DIRECT") {
      setRequestor("Direct Expense");
      setBudgetRequested(0);
    } else {
      const match = pendingAdvances.find(ca => ca.advanceId === selectedCaRef);
      if (match) {
        setRequestor(match.requestor);
        setFundSource(match.fundSource);
        setBudgetRequested(match.amountApproved);
      } else {
        setRequestor("");
        setBudgetRequested(0);
      }
    }
  }, [selectedCaRef, pendingAdvances]);

  const totalExpense = useMemo(() => {
    return expenseRows.reduce((sum, r) => sum + (r.subTotal || 0), 0);
  }, [expenseRows]);

  const variance = budgetRequested - totalExpense;

  const addRow = (prefill?: Partial<ExpenseRow>) => {
    setExpenseRows([...expenseRows, {
      id: Math.random().toString(36).substring(2, 9),
      qty: prefill?.qty || 1,
      orsi: prefill?.orsi || "",
      desc: prefill?.desc || "",
      subTotal: prefill?.subTotal || 0,
      proofBase64: prefill?.proofBase64,
      proofMime: prefill?.proofMime,
      fileName: prefill?.fileName
    }]);
  };

  const updateRow = (id: string, field: keyof ExpenseRow, value: string | number) => {
    setExpenseRows(expenseRows.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  // Handle File Attachment per Row
  const handleFileChange = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 650 * 1024) {
      void clearAlert("Please attach a compressed image or PDF smaller than 650 KB. The combined attachments must fit within the server request limit.");
      e.target.value = "";
      return;
    }

    if (!["image/png", "image/jpeg", "image/webp", "application/pdf"].includes(file.type)) {
      void clearAlert("Receipts must be PNG, JPEG, WebP or PDF files.");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      setExpenseRows(current => current.map(r => r.id === id ? {
        ...r,
        proofBase64: uploadEvent.target?.result as string,
        proofMime: file.type || "image/jpeg",
        fileName: file.name
      } : r));
    };
    reader.readAsDataURL(file);
  };

  const handleCommitFare = () => {
    if (!fareOrigin.trim() || !fareDestination.trim() || fareRate <= 0) {
      return void clearAlert("Please provide the origin, destination, and valid fare amount.");
    }

    const desc = `${fareMode} Fare: ${fareOrigin.trim()} → ${fareDestination.trim()}`;
    addRow({
      qty: farePassengers,
      orsi: "NON-RECEIPTED FARE",
      desc: desc,
      subTotal: computedFareTotal
    });

    setFareOrigin("");
    setFareDestination("");
    setFarePassengers(1);
    setFareRate(0);
    setShowFareModal(false);
  };

  const handleAddReimbursement = () => {
    void clearAlert("Reimbursement is calculated automatically when actual verified expenses exceed the approved Cash Advance. Do not insert a separate reimbursement item: doing so would double-count the expense. For a Direct Expense, record only actual purchased items and amounts.");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isClosed) return void clearAlert("This accounting period has already been carried over. Reverse the rollover before recording expenses.");
    if (!selectedCaRef) return void clearAlert("Select a Cash Advance reference ID or choose 'Direct Expense'.");
    if (expenseRows.length === 0 || totalExpense <= 0) return void clearAlert("Please add at least one valid expense item.");

    setIsSubmitting(true);
    try {
      await recordAudit(department, {
        date,
        advanceId: selectedCaRef === "DIRECT" ? "" : selectedCaRef,
        requestor,
        fundSource,
        budgetRequested,
        totalExpense,
        items: expenseRows,
        ay,
        term
      });

      void clearAlert("Liquidation successfully verified and recorded!");
      setSelectedCaRef("");
      setExpenseRows([{ id: "1", qty: 1, orsi: "", desc: "", subTotal: 0 }]);
      router.refresh();
    } catch (err: any) {
      void clearAlert("Error: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {isClosed && (
        <div className="alert alert-warning" role="alert">
          This term is closed by a carry-over. Liquidations cannot be posted until the rollover is reversed.
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <div className="row g-2 mb-3 mt-1">
          <div className="col-md-6">
            <label className="form-label text-muted small fw-semibold">Liquidation Date</label>
            <input type="date" className="form-control bg-body text-body border-secondary" value={date} onChange={e => setDate(e.target.value)} required />
          </div>
          <div className="col-md-6">
            <label className="form-label text-muted small fw-semibold">Track Cash Advance Reference</label>
            <select className="form-select bg-body text-body border-secondary" value={selectedCaRef} onChange={e => setSelectedCaRef(e.target.value)} required>
              <option value="">-- Select Cash Advance Reference ID --</option>
              {pendingAdvances.map(ca => (
                <option key={ca.advanceId} value={ca.advanceId}>
                  [{ca.advanceId}] {ca.requestor} — {fmt(ca.amountApproved)} ({ca.fundSource})
                </option>
              ))}
              <option value="DIRECT">-- Direct Expense (No Prior CA) --</option>
            </select>
          </div>
        </div>

        <div className="row g-2 mb-3">
          <div className="col-md-6">
            <label className="form-label text-muted small fw-semibold">Requestor / Officer</label>
            <input type="text" className="form-control bg-body-secondary text-body border-secondary" value={requestor} readOnly />
          </div>
          <div className="col-md-6">
            <label className="form-label text-muted small fw-semibold">Fund Pool</label>
            <select className="form-select bg-body text-body border-secondary" value={fundSource} onChange={e => setFundSource(e.target.value)} disabled={selectedCaRef !== "DIRECT" && selectedCaRef !== ""}>
              {funds.map(f => <option key={f.id} value={f.fundName}>{f.fundName}</option>)}
              <option value="General Fund (Carried Over)">General Fund (Carried Over)</option>
            </select>
          </div>
        </div>

        <div className="row g-2 mb-4">
          <div className="col-md-6">
            <label className="form-label text-muted small fw-semibold">Approved Budget (₱)</label>
            <input type="number" step="0.01" className="form-control bg-body-secondary text-body border-secondary" readOnly value={budgetRequested.toFixed(2)} />
          </div>
          <div className="col-md-6">
            <label className="form-label text-muted small fw-semibold">Total Liquidated (₱)</label>
            <input type="number" step="0.01" className="form-control bg-body-secondary text-body border-secondary" readOnly value={totalExpense.toFixed(2)} />
          </div>
        </div>

        {selectedCaRef === "DIRECT" && totalExpense > 0 && (
          <div className="alert alert-info small py-2">Direct Expense: {fmt(totalExpense)} will be deducted from the selected fund. No separate cash-advance reimbursement is calculated.</div>
        )}
        {selectedCaRef !== "DIRECT" && totalExpense > 0 && (
          <div className={`alert py-2 small mb-4 ${variance > 0 ? "alert-success" : variance < 0 ? "alert-danger" : "alert-info"}`}>
            {variance > 0 && <strong>SURPLUS / RETURN: {fmt(variance)} (To be returned to fund)</strong>}
            {variance < 0 && <strong>DEFICIT / REIMBURSEMENT: {fmt(Math.abs(variance))} (Owed to requestor)</strong>}
            {variance === 0 && <strong>EXACT LIQUIDATION (₱0.00 Variance)</strong>}
          </div>
        )}

        <h6 className="text-info fw-bold mb-3">Itemized Receipts</h6>
        <div className="mb-4">
          {expenseRows.map((row) => (
            <div key={row.id} className="row g-2 mb-2 align-items-center">
              <div className="col-12 col-md-1">
                <input type="number" placeholder="Qty" className="form-control form-control-sm bg-body text-body border-secondary" min="1" value={row.qty} onChange={e => updateRow(row.id, 'qty', parseInt(e.target.value) || 1)} required />
              </div>
              <div className="col-12 col-md-2">
                <input type="text" placeholder="OR/SI #" className="form-control form-control-sm bg-body text-body border-secondary" value={row.orsi} onChange={e => updateRow(row.id, 'orsi', e.target.value)} />
              </div>
              <div className="col-12 col-md-3">
                <input type="text" placeholder="Description" className="form-control form-control-sm bg-body text-body border-secondary" value={row.desc} onChange={e => updateRow(row.id, 'desc', e.target.value)} required />
              </div>
              <div className="col-12 col-md-2">
                <input type="number" step="0.01" placeholder="Subtotal" className="form-control form-control-sm bg-body text-body border-secondary" value={row.subTotal || ""} onChange={e => updateRow(row.id, 'subTotal', parseFloat(e.target.value) || 0)} required />
              </div>
              <div className="col-10 col-md-3">
                <div className="input-group input-group-sm">
                  <input type="file" accept="image/*,application/pdf" className="form-control form-control-sm bg-body text-body border-secondary" onChange={e => handleFileChange(row.id, e)} />
                  <span className={`input-group-text border-secondary ${row.proofBase64 ? 'bg-success text-white' : 'bg-body-secondary text-muted'}`} title={row.fileName || "No file attached"}>
                    <i className={`bi ${row.proofBase64 ? 'bi-check2' : 'bi-paperclip'}`}></i>
                  </span>
                </div>
              </div>
              <div className="col-2 col-md-1 text-end">
                <button type="button" className="btn btn-outline-danger btn-sm py-0 w-100" onClick={() => setExpenseRows(expenseRows.filter(r => r.id !== row.id))}>&times;</button>
              </div>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="d-flex gap-2 mb-4 flex-wrap">
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => addRow()}>
            <i className="bi bi-plus-circle me-1"></i>+ Add Item
          </button>
          <button type="button" className="btn btn-outline-warning btn-sm fw-semibold" onClick={() => setShowFareModal(true)}>
            <i className="bi bi-bicycle me-1"></i>Add Fare
          </button>
          <button type="button" className="btn btn-outline-info btn-sm fw-semibold" onClick={handleAddReimbursement}>
            <i className="bi bi-info-circle me-1"></i>Reimbursement Info
          </button>
        </div>

        <button type="submit" className="btn btn-info fw-bold w-100 py-2" disabled={isSubmitting || isClosed}>
          {isSubmitting ? "Verifying..." : "Verify & Settle Liquidation"}
        </button>
      </form>

      {/* NON-RECEIPTED FARE MODAL */}
      {showFareModal && (
        <div className="modal fade show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content card border-secondary bg-body text-body shadow-lg clear-theme-modal">
              <div className="modal-header border-secondary">
                <h5 className="modal-title text-warning"><i className="bi bi-signpost-2 me-2"></i>Non-Receipted Fare Particulars</h5>
                <button type="button" className="btn-close" onClick={() => setShowFareModal(false)}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label text-muted small fw-semibold">Conveyance / Mode</label>
                  <select className="form-select bg-body text-body border-secondary" value={fareMode} onChange={e => setFareMode(e.target.value)}>
                    <option value="Tricycle">Tricycle Fare</option>
                    <option value="Jeepney">Jeepney Fare</option>
                    <option value="Motorcycle / Habal-habal">Motorcycle / Habal-habal Fare</option>
                    <option value="Van / Bus">Van / Bus Fare</option>
                  </select>
                </div>
                <div className="row g-2 mb-3">
                  <div className="col-6">
                    <label className="form-label text-muted small fw-semibold">Origin / From</label>
                    <input type="text" className="form-control bg-body text-body border-secondary" placeholder="e.g. FCU Campus" value={fareOrigin} onChange={e => setFareOrigin(e.target.value)} required />
                  </div>
                  <div className="col-6">
                    <label className="form-label text-muted small fw-semibold">Destination / To</label>
                    <input type="text" className="form-control bg-body text-body border-secondary" placeholder="e.g. Terminal" value={fareDestination} onChange={e => setFareDestination(e.target.value)} required />
                  </div>
                </div>
                <div className="row g-2 mb-4">
                  <div className="col-6">
                    <label className="form-label text-muted small fw-semibold">Passenger Count / Qty</label>
                    <input type="number" className="form-control bg-body text-body border-secondary" value={farePassengers} min={1} onChange={e => setFarePassengers(parseInt(e.target.value) || 1)} />
                  </div>
                  <div className="col-6">
                    <label className="form-label text-muted small fw-semibold">Fare per Passenger (₱)</label>
                    <input type="number" step="0.01" className="form-control bg-body text-body border-secondary" placeholder="0.00" value={fareRate || ""} onChange={e => setFareRate(parseFloat(e.target.value) || 0)} required />
                  </div>
                </div>
                <div className="alert alert-info border-info py-2 small d-flex justify-content-between align-items-center mb-0">
                  <span className="fw-semibold">Computed Total:</span>
                  <strong className="fs-6">{fmt(computedFareTotal)}</strong>
                </div>
              </div>
              <div className="modal-footer border-secondary">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowFareModal(false)}>Cancel</button>
                <button type="button" className="btn btn-warning btn-sm fw-bold text-dark" onClick={handleCommitFare}>
                  <i className="bi bi-plus-lg me-1"></i>Insert Fare Item
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}