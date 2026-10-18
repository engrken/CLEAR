// /app/department/[department]/(protected)/cashier-remittance/CashierRemittanceForm.tsx

"use client";
import { manilaDateInput, formatManilaLongDate } from '@/lib/clear-timezone';
import { clearAlert, clearConfirm, clearPrompt } from "@/lib/clear-dialogs";


import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { fmt } from "@/lib/utils";
import { format } from "date-fns";
import { recordCashierRemittance, voidCashierRemittance } from "./actions";

interface Fund {
  id: string;
  fundName: string;
  availablePhysical?: number;
  heldByCashier?: number;
}

interface CashierRemittance {
  id: string;
  remittanceId: string;
  date: Date | string;
  remittedBy: string;
  fundSource: string;
  type: string;
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
  remittances,
  orgName,
  reportSchoolName = "",
  reportSchoolAddress = "",
  cashierBalance = 0,
  legacyPooledHeld = 0,
  availableCash = 0,
  periodClosed = false,
}: {
  department: string;
  ay: string;
  term: string;
  funds: Fund[];
  remittances: CashierRemittance[];
  orgName: string;
  reportSchoolName?: string | null;
  reportSchoolAddress?: string | null;
  cashierBalance?: number;
  legacyPooledHeld?: number;
  availableCash?: number;
  periodClosed?: boolean;
}) {
  const router = useRouter();
  const todayStr = manilaDateInput();

  const [transactionType, setTransactionType] = useState("Deposit");
  const [date, setDate] = useState(todayStr);
  const [remittedBy, setRemittedBy] = useState("");
  const legacyPool = "Remaining Balance (Net Ending Position)";
  const defaultDepositFund = funds.find(f => (f.availablePhysical ?? 0) > 0.005)?.fundName ?? funds[0]?.fundName ?? "";
  const defaultWithdrawalFund = funds.find(f => (f.heldByCashier ?? 0) > 0.005)?.fundName ?? (legacyPooledHeld > 0.005 ? legacyPool : "");
  const [fundSource, setFundSource] = useState(defaultDepositFund);
  const chooseTransactionType = (nextType: string) => {
    setTransactionType(nextType);
    setFundSource(nextType === "Deposit" ? defaultDepositFund : defaultWithdrawalFund);
  };
  const [amount, setAmount] = useState("");
  const [cashierReceiptNo, setCashierReceiptNo] = useState("");
  const [remarks, setRemarks] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 🖨️ State to hold data for the printable voucher
  const [printData, setPrintData] = useState<CashierRemittance | null>(null);

  // 🖊️ Dynamic Signatory States
  const [prepName, setPrepName] = useState("");
  const [prepTitle, setPrepTitle] = useState("Prepared / Requested By");
  
  const [notedName, setNotedName] = useState("");
  const [notedTitle, setNotedTitle] = useState("Noted By (Adviser)");
  
  const [recName, setRecName] = useState("");
  const [recTitle, setRecTitle] = useState("Cashier / Finance Officer");

  useEffect(() => {
    if (printData) {
      setPrepName(printData.remittedBy);
    }
  }, [printData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (periodClosed) return void clearAlert("This term has already been carried over. Reverse the rollover before recording cashier transactions.");
    if (!fundSource) return void clearAlert("Please select a valid source fund.");
    if (transactionType === "Deposit" && fundSource === legacyPool) return void clearAlert("Select a real source fund; Net Ending Position is not a fund.");
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || Math.round(parsedAmount * 100) / 100 !== parsedAmount) return void clearAlert("Enter a positive amount with up to two decimal places.");
    if (transactionType === "Deposit" && parsedAmount > availableCash + 0.001) return void clearAlert("Insufficient cash on hand for this deposit.");
    if (transactionType === "Withdrawal" && parsedAmount > cashierBalance + 0.001) return void clearAlert("Insufficient safekeeping balance for this withdrawal.");
    
    const actionText = transactionType === "Deposit" ? "deposit to" : "withdraw from";
    if (!await clearConfirm(`Are you sure you want to log a safekeeping ${actionText} the University Cashier for ${fmt(parsedAmount)}?`)) return;

    setIsSubmitting(true);
    try {
      const res = await recordCashierRemittance(department, {
        date,
        remittedBy,
        fundSource,
        type: transactionType,
        amount: parsedAmount,
        cashierReceiptNo,
        remarks,
        ay,
        term
      });

      setPrintData({
        id: "new_record",
        remittanceId: res.remittanceId,
        date: date,
        remittedBy,
        fundSource,
        type: transactionType,
        amount: parsedAmount,
        cashierReceiptNo,
        remarks,
        status: "Remitted"
      });

      setAmount("");
      setCashierReceiptNo("");
      setRemarks("");
      // Refresh the ledger and history after successful deposit or withdrawal.
      router.refresh();
    } catch (err: any) {
      void clearAlert("Error: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVoid = async (id: string, ref: string) => {
    if (!await clearConfirm(`Are you sure you want to VOID record [${ref}]?`)) return;
    try {
      await voidCashierRemittance(department, id);
      void clearAlert("Record voided successfully.");
      router.refresh();
    } catch (err: any) {
      void clearAlert("Error: " + err.message);
    }
  };

  // =========================================================
  // 🖨️ PRINTABLE ACKNOWLEDGEMENT FORM UI
  // =========================================================
  if (printData) {
    return (
      <div className="d-flex flex-column align-items-center animation-fade-in text-body">
        
        {/* ⚙️ SIGNATORY SETUP PANEL */}
        <div className="card mb-4 border-info shadow-sm d-print-none w-100 bg-body" style={{ maxWidth: '800px' }}>
          <div className="card-header bg-info bg-opacity-10 border-info text-info fw-bold d-flex justify-content-between align-items-center">
            <span><i className="bi bi-pen me-2"></i>Signatory Setup</span>
            <span className="badge bg-info text-dark">Pre-Print Configuration</span>
          </div>
          <div className="card-body row g-3">
            
            {/* 💡 FIX 1: Theme-adaptive warning alert that is fully readable in Dark Mode */}
            <div className="col-12 mb-0 pb-0">
              <div className="alert py-2 mb-0 small border border-warning bg-warning bg-opacity-10 text-warning">
                <i className="bi bi-info-circle-fill me-2"></i>
                <strong>Note:</strong> You can type the names below to print them. <strong>If left blank, a blank underline will automatically be generated</strong> for manual physical signatures.
              </div>
            </div>

            <div className="col-md-4 mt-2">
              <label className="small text-muted fw-bold mb-1">Signatory 1 (Left)</label>
              <input type="text" className="form-control form-control-sm bg-body text-body border-secondary mb-1" placeholder="Name (Leave blank to write)" value={prepName} onChange={e => setPrepName(e.target.value)} />
              <input type="text" className="form-control form-control-sm bg-body-secondary text-body border-secondary" placeholder="Designation" value={prepTitle} onChange={e => setPrepTitle(e.target.value)} />
            </div>
            <div className="col-md-4 mt-2">
              <label className="small text-muted fw-bold mb-1">Signatory 2 (Center)</label>
              <input type="text" className="form-control form-control-sm bg-body text-body border-secondary mb-1" placeholder="Name (Leave blank to write)" value={notedName} onChange={e => setNotedName(e.target.value)} />
              <input type="text" className="form-control form-control-sm bg-body-secondary text-body border-secondary" placeholder="Designation" value={notedTitle} onChange={e => setNotedTitle(e.target.value)} />
            </div>
            <div className="col-md-4 mt-2">
              <label className="small text-muted fw-bold mb-1">Signatory 3 (Right)</label>
              <input type="text" className="form-control form-control-sm bg-body text-body border-secondary mb-1" placeholder="Name (Leave blank to write)" value={recName} onChange={e => setRecName(e.target.value)} />
              <input type="text" className="form-control form-control-sm bg-body-secondary text-body border-secondary" placeholder="Designation" value={recTitle} onChange={e => setRecTitle(e.target.value)} />
            </div>
          </div>
        </div>

        {/* 📄 THE ACTUAL PRINTABLE PAPER VOUCHER */}
        {/* 💡 FIX 2: Forced color variables to insulate the paper from Dark Mode inheritance */}
        <div id="printable-remittance" className="card border-dark w-100 shadow" style={{ maxWidth: '800px', borderRadius: '0px', backgroundColor: 'white', color: 'black' }}>
          <div className="card-body p-4 p-md-5">
            
            <div className="text-center mb-4 pb-3 border-bottom border-dark">
              {reportSchoolName && <div className="fw-bold text-uppercase">{reportSchoolName}</div>}
              <h4 className="fw-bold text-uppercase mb-1">{orgName}</h4>
              {reportSchoolAddress && <div className="small">{reportSchoolAddress}</div>}
              <h5 className="mt-4 fw-bold text-uppercase" style={{ letterSpacing: '1px' }}>
                {printData.type === "Deposit" ? "Cash Remittance Voucher" : "Cash Withdrawal Voucher"}
              </h5>
            </div>

            <div className="row mb-4">
              <div className="col-6">
                <div className="small mb-1 text-uppercase fw-bold" style={{ opacity: 0.6 }}>System Tracking No.</div>
                <div className="fw-bold font-monospace fs-5">{printData.remittanceId}</div>
              </div>
              <div className="col-6 text-end">
                <div className="small mb-1 text-uppercase fw-bold" style={{ opacity: 0.6 }}>Date of {printData.type === "Deposit" ? "Turnover" : "Withdrawal"}</div>
                <div className="fw-bold">{formatManilaLongDate(printData.date)}</div>
              </div>
            </div>

            {/* 💡 FIX 2 (Table): Stripped Bootstrap's dark mode table variables */}
            <table className="table table-bordered border-dark mb-5 align-middle" style={{ '--bs-table-bg': 'white', '--bs-table-color': 'black', color: 'black' } as React.CSSProperties}>
              <tbody>
                <tr>
                  <td className="fw-bold text-uppercase small" style={{ width: '35%', backgroundColor: '#e9ecef', color: 'black' }}>Source Fund / Pool</td>
                  <td className="fw-semibold" style={{ backgroundColor: 'white', color: 'black' }}>{printData.fundSource}</td>
                </tr>
                <tr>
                  <td className="fw-bold text-uppercase small" style={{ backgroundColor: '#e9ecef', color: 'black' }}>Remarks / Particulars</td>
                  <td style={{ backgroundColor: 'white', color: 'black' }}>{printData.remarks || "—"}</td>
                </tr>
                <tr>
                  <td className="fw-bold text-uppercase small" style={{ backgroundColor: '#e9ecef', color: 'black' }}>Cashier O.R. Reference</td>
                  <td className="font-monospace" style={{ backgroundColor: 'white', color: 'black' }}>{printData.cashierReceiptNo || "To be issued physically"}</td>
                </tr>
                <tr>
                  <td className="fw-bold text-uppercase fs-6" style={{ backgroundColor: '#e9ecef', color: 'black' }}>Total Amount {printData.type === "Deposit" ? "Remitted" : "Withdrawn"}</td>
                  <td className={`fw-bold fs-5 ${printData.type === "Deposit" ? "text-success" : "text-danger"}`} style={{ backgroundColor: 'white' }}>
                    {fmt(printData.amount)}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* 🖊️ DYNAMIC SIGNATORIES */}
            <div className="row mt-5 pt-5 text-center">
              <div className="col-4">
                <div className="border-bottom border-dark d-inline-block px-2 fw-bold mb-1 w-100 text-truncate" style={{ height: '24px' }}>
                  {prepName || "\u00A0"}
                </div>
                <div className="small fw-semibold" style={{ opacity: 0.6 }}>{prepTitle}</div>
              </div>
              <div className="col-4">
                <div className="border-bottom border-dark d-inline-block px-2 fw-bold mb-1 w-100 text-truncate" style={{ height: '24px' }}>
                  {notedName || "\u00A0"}
                </div>
                <div className="small fw-semibold" style={{ opacity: 0.6 }}>{notedTitle}</div>
              </div>
              <div className="col-4">
                <div className="border-bottom border-dark d-inline-block px-2 fw-bold mb-1 w-100 text-truncate" style={{ height: '24px' }}>
                  {recName || "\u00A0"}
                </div>
                <div className="small fw-semibold" style={{ opacity: 0.6 }}>{recTitle}</div>
              </div>
            </div>

          </div>
        </div>

        <div className="d-flex flex-column flex-sm-row gap-3 mt-4 d-print-none w-100" style={{ maxWidth: '800px' }}>
          <button className="btn btn-outline-secondary py-2 fw-bold flex-grow-1" onClick={() => window.print()}>
            <i className="bi bi-printer me-2"></i>Print Voucher
          </button>
          <button className="btn btn-info py-2 text-dark fw-bold flex-grow-1" onClick={() => setPrintData(null)}>
            <i className="bi bi-arrow-left-circle me-2"></i>Back to Records
          </button>
        </div>

        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            body * { visibility: hidden; }
            #printable-remittance, #printable-remittance * { visibility: visible; color: black !important; }
            #printable-remittance { position: absolute; left: 50%; top: 0; transform: translateX(-50%); width: 100%; border: none !important; box-shadow: none !important; }
            .d-print-none { display: none !important; }
            .bg-white { background-color: white !important; }
          }
        `}} />
      </div>
    );
  }

  // =========================================================
  // 📝 STANDARD LOGGING FORM UI
  // =========================================================
  return (
    <>
      {periodClosed && <div className="alert alert-warning">This term is closed by a carry-over. Reverse the rollover in Setup to reopen it.</div>}
      <div className="alert alert-secondary small">Cashier held: <strong>{fmt(cashierBalance)}</strong> | Physical cash available: <strong>{fmt(availableCash)}</strong>. Safekeeping changes cash location, not income.</div>
      <form onSubmit={handleSubmit} className="mb-4 card p-3 border-secondary bg-body shadow-sm text-body">
        
        <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom border-secondary">
          <h6 className="text-info fw-bold mb-0">
            <i className="bi bi-bank me-2"></i>University Cashier Transaction
          </h6>
          <div className="btn-group" role="group">
            <input type="radio" className="btn-check" name="btnType" id="btnDeposit" autoComplete="off" checked={transactionType === "Deposit"} onChange={() => chooseTransactionType("Deposit")} />
            <label className="btn btn-outline-success btn-sm fw-bold" htmlFor="btnDeposit">Deposit</label>

            <input type="radio" className="btn-check" name="btnType" id="btnWithdraw" autoComplete="off" checked={transactionType === "Withdrawal"} onChange={() => chooseTransactionType("Withdrawal")} />
            <label className="btn btn-outline-danger btn-sm fw-bold" htmlFor="btnWithdraw">Withdraw</label>
          </div>
        </div>

        <div className="row g-3 mb-3">
          <div className="col-md-6">
            <label className="form-label text-muted small fw-semibold">Date of Transaction</label>
            <input type="date" className="form-control py-2 bg-body text-body border-secondary" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="col-md-6">
            <label className="form-label text-muted small fw-semibold">
              {transactionType === "Deposit" ? "Turned Over By (Officer)" : "Requested / Withdrawn By"}
            </label>
            <input type="text" className="form-control py-2 bg-body text-body border-secondary" placeholder="e.g. Juan Dela Cruz" value={remittedBy} onChange={(e) => setRemittedBy(e.target.value)} required />
          </div>
        </div>

        <div className="row g-3 mb-3">
          <div className="col-md-6">
            <label className="form-label text-muted small fw-semibold">Source Fund (cash custody only)</label>
            <select className="form-select py-2 bg-body text-body border-secondary" value={fundSource} onChange={(e) => setFundSource(e.target.value)} required>
              <option value="" disabled>Select a real fund</option>
              {funds.map((fund) => (
                <option key={fund.id} value={fund.fundName} disabled={transactionType === "Withdrawal" ? (fund.heldByCashier ?? 0) < 0.005 : (fund.availablePhysical ?? 0) < 0.005}>
                  {fund.fundName}{transactionType === "Withdrawal" ? ` (held: ₱${Number(fund.heldByCashier ?? 0).toFixed(2)})` : ` (on hand: ₱${Number(fund.availablePhysical ?? 0).toFixed(2)})`}
                </option>
              ))}
              {transactionType === "Withdrawal" && legacyPooledHeld > 0.005 && (
                <option value={legacyPool}>Legacy pooled cashier balance (held: ₱{legacyPooledHeld.toFixed(2)})</option>
              )}
            </select>
            <div className="form-text text-secondary">Choose a real fund for new deposits. This moves cash to safekeeping without changing fund income or balances.</div>
          </div>
          <div className="col-md-6">
            <label className={`form-label fw-bold small ${transactionType === "Deposit" ? "text-success" : "text-danger"}`}>
              Total Amount (₱)
            </label>
            <input type="number" step="0.01" min="0" inputMode="decimal" className={`form-control py-2 bg-body text-body fw-bold ${transactionType === "Deposit" ? "border-success text-success" : "border-danger text-danger"}`} value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
        </div>

        <div className="row g-3 mb-4">
          <div className="col-md-6">
            <label className="form-label text-muted small fw-semibold">University Cashier OR Number (Optional)</label>
            <input type="text" className="form-control py-2 bg-body text-body border-secondary font-monospace" placeholder="e.g. FCU-OR-9912" value={cashierReceiptNo} onChange={(e) => setCashierReceiptNo(e.target.value)} />
          </div>
          <div className="col-md-6">
            <label className="form-label text-muted small fw-semibold">Remarks / Description</label>
            <input type="text" className="form-control py-2 bg-body text-body border-secondary" placeholder="e.g. First semester partial turnover" value={remarks} onChange={(e) => setRemarks(e.target.value)} required />
          </div>
        </div>

        <button type="submit" className={`btn py-2 fw-bold w-100 text-white ${transactionType === "Deposit" ? "btn-success" : "btn-danger"}`} disabled={isSubmitting || periodClosed}>
          {isSubmitting ? "Processing..." : `Log Safekeeping ${transactionType}`}
        </button>
      </form>

      {/* RECENT RECORDS */}
      <div className="card border-secondary bg-body shadow-sm p-0 text-body">
        <div className="p-3 border-bottom border-secondary d-flex justify-content-between align-items-center">
          <h6 className="fw-bold text-info mb-0">Transaction History</h6>
          <span className="badge bg-secondary text-white">{remittances.length} Records</span>
        </div>
        
        <div className="table-responsive">
          <table className="table table-hover align-middle text-body mb-0">
            <thead className="bg-body-secondary">
              <tr className="text-muted small">
                <th className="py-3 px-3">Date</th>
                <th className="py-3">Type</th>
                <th className="py-3">Fund / Officer</th>
                <th className="py-3 text-end">Amount</th>
                <th className="py-3 text-center">Status</th>
                <th className="py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {remittances.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-5">
                    <i className="bi bi-bank fs-2 d-block mb-2 opacity-50"></i>
                    No safekeeping transactions logged for this term.
                  </td>
                </tr>
              ) : (
                remittances.map((r) => (
                  <tr key={r.id} className={r.status === "Voided" ? "opacity-50" : ""}>
                    <td className="px-3 small text-muted">{manilaDateInput(r.date)}</td>
                    <td>
                      <span className={`badge ${r.type === "Deposit" ? "bg-success bg-opacity-10 text-success border border-success" : "bg-danger bg-opacity-10 text-danger border border-danger"}`}>
                        {r.type === "Withdrawal" ? "Withdrawn" : "Deposited"}
                      </span>
                    </td>
                    <td>
                      <strong className="d-block small">{r.fundSource === legacyPool ? "Legacy pooled position (historical)" : r.fundSource}</strong>
                      <span className="small text-muted">by {r.remittedBy}</span>
                    </td>
                    <td className={`text-end fw-bold ${r.type === "Deposit" ? "text-success" : "text-danger"}`}>
                      {r.type === "Withdrawal" ? "-" : "+"}{fmt(r.amount)}
                    </td>
                    <td className="text-center">
                      <span className={`badge ${r.status === "Voided" ? "bg-secondary" : r.type === "Withdrawal" ? "bg-danger" : "bg-success"}`}>{r.status === "Voided" ? "Voided" : r.type === "Withdrawal" ? "Withdrawn" : "Deposited"}</span>
                    </td>
                    <td className="text-center">
                      {r.status !== "Voided" && (
                        <div className="d-flex gap-1 justify-content-center">
                          <button className="btn btn-outline-info btn-sm py-0 fw-bold" onClick={() => setPrintData(r)} title="Print Voucher">
                            <i className="bi bi-printer"></i>
                          </button>
                          <button className="btn btn-outline-danger btn-sm py-0 fw-bold" onClick={() => handleVoid(r.id, r.remittanceId)} title="Void Record">
                            <i className="bi bi-x-circle"></i>
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
      </div>
    </>
  );
}