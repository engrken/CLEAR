"use client";

import { useState } from "react";
import { fmt } from "@/lib/utils";
import { format } from "date-fns";
import { recordCashierRemittance, voidCashierRemittance } from "./actions";

interface Fund {
  id: string;
  fundName: string;
}

interface CashierRemittance {
  id: string;
  remittanceId: string;
  date: Date | string;
  remittedBy: string;
  fundSource: string;
  amount: number;
  cashierReceiptNo: string | null;
  remarks: string | null;
  status: string;
}

export default function CashierRemittanceForm({
  department,
  ay,
  term,
  funds,
  remittances
}: {
  department: string;
  ay: string;
  term: string;
  funds: Fund[];
  remittances: CashierRemittance[];
}) {
  const todayStr = new Date().toISOString().split("T")[0];

  const [date, setDate] = useState(todayStr);
  const [remittedBy, setRemittedBy] = useState("");
  const [fundSource, setFundSource] = useState(funds[0]?.fundName || "General Fund");
  const [amount, setAmount] = useState("");
  const [cashierReceiptNo, setCashierReceiptNo] = useState("");
  const [remarks, setRemarks] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (parsedAmount <= 0) return alert("Amount must be greater than zero.");
    
    if (!confirm(`Are you sure you want to record a safekeeping deposit of ${fmt(parsedAmount)} to the University Cashier?`)) return;

    setIsSubmitting(true);
    try {
      await recordCashierRemittance(department, {
        date,
        remittedBy,
        fundSource,
        amount: parsedAmount,
        cashierReceiptNo,
        remarks,
        ay,
        term
      });

      alert("Safekeeping deposit successfully logged!");
      setAmount("");
      setCashierReceiptNo("");
      setRemarks("");
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVoid = async (id: string, ref: string) => {
    if (!confirm(`Are you sure you want to VOID safekeeping record [${ref}]?\n\nThis requires Admin/Void access.`)) return;
    try {
      await voidCashierRemittance(department, id);
      alert("Record voided successfully.");
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="mb-4 card p-3 border-secondary bg-body shadow-sm text-body">
        <h6 className="text-info fw-bold mb-3">
          <i className="bi bi-shield-lock me-2"></i>Log Safekeeping Deposit
        </h6>

        <div className="row g-3 mb-3">
          <div className="col-md-6">
            <label className="form-label text-muted small fw-semibold">Date of Deposit</label>
            <input type="date" className="form-control py-2 bg-body text-body border-secondary" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="col-md-6">
            <label className="form-label text-muted small fw-semibold">Turned Over By (Officer Name)</label>
            <input type="text" className="form-control py-2 bg-body text-body border-secondary" placeholder="e.g. Juan Dela Cruz" value={remittedBy} onChange={(e) => setRemittedBy(e.target.value)} required />
          </div>
        </div>

        <div className="row g-3 mb-3">
          <div className="col-md-6">
            <label className="form-label text-muted small fw-semibold">Source Fund Pool</label>
            <select className="form-select py-2 bg-body text-body border-secondary" value={fundSource} onChange={(e) => setFundSource(e.target.value)} required>
              {funds.map((fund) => (
                <option key={fund.id} value={fund.fundName}>{fund.fundName}</option>
              ))}
              <option value="General Fund">General Fund</option>
            </select>
          </div>
          <div className="col-md-6">
            <label className="form-label text-info fw-bold small">Total Amount Remitted (₱)</label>
            <input type="number" step="0.01" min="0" inputMode="decimal" className="form-control py-2 bg-body text-body border-info fw-bold text-info" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
        </div>

        <div className="row g-3 mb-3">
          <div className="col-md-6">
            <label className="form-label text-muted small fw-semibold">University Cashier OR Number (Optional)</label>
            <input type="text" className="form-control py-2 bg-body text-body border-secondary font-monospace" placeholder="e.g. FCU-OR-9912" value={cashierReceiptNo} onChange={(e) => setCashierReceiptNo(e.target.value)} />
          </div>
          <div className="col-md-6">
            <label className="form-label text-muted small fw-semibold">Remarks / Description</label>
            <input type="text" className="form-control py-2 bg-body text-body border-secondary" placeholder="e.g. First semester partial turnover" value={remarks} onChange={(e) => setRemarks(e.target.value)} required />
          </div>
        </div>

        <button type="submit" className="btn btn-info py-2 fw-bold w-100 text-dark" disabled={isSubmitting}>
          {isSubmitting ? "Logging Deposit..." : "Log Safekeeping Remittance"}
        </button>
      </form>

      {/* RECENT REMITTANCES LOG */}
      <div className="card border-secondary bg-body shadow-sm p-0 text-body">
        <div className="p-3 border-bottom border-secondary d-flex justify-content-between align-items-center">
          <h6 className="fw-bold text-info mb-0">Remittance History</h6>
          <span className="badge bg-secondary text-white">{remittances.length} Records</span>
        </div>
        
        <div className="table-responsive">
          <table className="table table-hover align-middle text-body mb-0">
            <thead className="bg-body-secondary">
              <tr className="text-muted small">
                <th className="py-3 px-3">Date</th>
                <th className="py-3">Fund / Officer</th>
                <th className="py-3">Remarks & OR</th>
                <th className="py-3 text-end">Amount</th>
                <th className="py-3 text-center">Status</th>
                <th className="py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {remittances.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-5">
                    <i className="bi bi-safe2 fs-2 d-block mb-2 opacity-50"></i>
                    No safekeeping remittances logged for this term.
                  </td>
                </tr>
              ) : (
                remittances.map((r) => (
                  <tr key={r.id} className={r.status === "Voided" ? "opacity-50" : ""}>
                    <td className="px-3 small text-muted">{format(new Date(r.date), "yyyy-MM-dd")}</td>
                    <td>
                      <strong className="d-block">{r.fundSource}</strong>
                      <span className="small text-muted">by {r.remittedBy}</span>
                    </td>
                    <td>
                      <span className="d-block small">{r.remarks}</span>
                      {r.cashierReceiptNo && <span className="badge bg-body-secondary border border-secondary text-muted font-monospace">{r.cashierReceiptNo}</span>}
                    </td>
                    <td className="text-end fw-bold text-success">{fmt(r.amount)}</td>
                    <td className="text-center">
                      <span className={`badge ${r.status === "Voided" ? "bg-secondary" : "bg-success"}`}>{r.status}</span>
                    </td>
                    <td className="text-center">
                      {r.status !== "Voided" && (
                        <button className="btn btn-outline-danger btn-sm py-0 fw-bold" onClick={() => handleVoid(r.id, r.remittanceId)}>
                          Void
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}