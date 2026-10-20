// /app/department/[department]/(protected)/collections/CollectionsForms.tsx

"use client";
import { manilaDateInput, formatManilaLongDate } from '@/lib/clear-timezone';
import { clearAlert, clearConfirm, clearPrompt } from "@/lib/clear-dialogs";


import { useState, useMemo, useEffect, useRef } from "react";
import { fmt, formatHoursAndMinutes } from "@/lib/utils";
import { getStudentPaymentCredits, recordPayment } from "./actions";
import { calculateCollectionBalancePreview } from "@/lib/collection-payment-preview.mjs";
import { ThemedAlert } from "@/lib/clear-dialogs";
import { PENALTY_FUND_NAME } from "@/lib/penalty-fund";

interface Student {
  studentId: string;
  fullName: string;
  email: string | null;
}

interface Fund {
  id: string;
  fundName: string;
}

interface CollectionSetup {
  id: string;
  category: string;
  name: string;
  amount: number;
  targetFund: string;
  isPackage?: boolean;
}

const DEPARTMENTAL_PACKAGE_NAME = "Departmental Fee Package (All Items)";

export default function CollectionsForm({
  department,
  ay,
  term,
  students,
  funds,
  collectionItems,
  prefillId,
  penaltyId,
  prefillCategory,
  prefillDesc,
  prefillAmount,
  prefillFund,
  penaltyState,
  closed = false,
}: {
  department: string;
  ay: string;
  term: string;
  students: Student[];
  funds: Fund[];
  collectionItems: CollectionSetup[];
  prefillId: string;
  penaltyId?: string;
  prefillCategory?: string;
  prefillDesc?: string;
  prefillAmount?: string;
  prefillFund?: string;
  penaltyState?: { balance: number; ratePerHour: number; originalHours: number; status: string };
  closed?: boolean;
}) {
  const todayStr = manilaDateInput();

  const categories: string[] = useMemo(() => {
    return Array.from(new Set(collectionItems.map((item) => String(item.category))));
  }, [collectionItems]);

  const [date, setDate] = useState(todayStr);


  const [searchQuery, setSearchQuery] = useState("");
  const [studentId, setStudentId] = useState("");
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");

  const [category, setCategory] = useState(prefillCategory || categories[0] || "");
  const [itemDescription, setItemDescription] = useState(prefillDesc || "");

  const [paymentType, setPaymentType] = useState("Full Payment");
  const [amountPaid, setAmountPaid] = useState(prefillAmount || "");
  const [fundAllocation, setFundAllocation] = useState("");
  // Fetch credits for the selected student only, not the full tenant ledger.
  const [creditSnapshot, setCreditSnapshot] = useState<{
    studentId: string;
    credits: Array<{ itemDescription: string; paidCents: number }>;
  } | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceError, setBalanceError] = useState("");
  const [balanceRefresh, setBalanceRefresh] = useState(0);

  const pendingPayment = useRef<{ signature: string; requestId: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);

  const currentCategoryItems = useMemo(() => {
    return collectionItems.filter((item) => item.category === category);
  }, [category, collectionItems]);

  const packageItems = useMemo(() => {
    return currentCategoryItems.filter((item) => item.isPackage === true);
  }, [currentCategoryItems]);

  const packageTotal = useMemo(() => {
    return packageItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  }, [packageItems]);

  useEffect(() => {
    if (!prefillId) return;

    const match = students.find((s) => s.studentId.toLowerCase() === prefillId.toLowerCase());
    if (match) {
      setSearchQuery(`${match.fullName} (${match.studentId})`);
      setStudentId(match.studentId);
      setStudentName(match.fullName);
      setStudentEmail(match.email || "");
    }
  }, [prefillId, students]);

  useEffect(() => {
    if (prefillCategory) setCategory(prefillCategory);
    if (prefillDesc) setItemDescription(prefillDesc);
  }, [prefillCategory, prefillDesc]);

  useEffect(() => {
    if (!studentId || penaltyId) {
      setCreditSnapshot(null);
      setBalanceLoading(false);
      setBalanceError("");
      return;
    }
    // Switching students invalidates any in-flight response from the last one.
    let cancelled = false;
    setCreditSnapshot(null);
    setBalanceLoading(true);
    setBalanceError("");
    getStudentPaymentCredits(department, { studentId, ay, term })
      .then((result) => {
        if (!cancelled) setCreditSnapshot({ studentId, credits: result.credits });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setBalanceError(error instanceof Error ? error.message : "Unable to load the current balance.");
        }
      })
      .finally(() => { if (!cancelled) setBalanceLoading(false); });
    return () => { cancelled = true; };
  }, [department, ay, term, studentId, penaltyId, balanceRefresh]);

  // Read the same destination fund shown in Setup Collection Fees.
  // For collectible payments the fee's fund is not an editable field.
  // Penalties are separate: they do not have a CollectionSetup fee entry.
  const prefilledSetupFee = useMemo(() => {
    if (!prefillDesc || penaltyId) return undefined;
    return collectionItems.find((item) =>
      item.isPackage === false &&
      item.category.trim().toLowerCase() === category.trim().toLowerCase() &&
      item.name.trim().toLowerCase() === prefillDesc.trim().toLowerCase()
    );
  }, [collectionItems, category, prefillDesc, penaltyId]);

  const invalidPrefilledFund = Boolean(
    prefillDesc && !penaltyId &&
    (!prefilledSetupFee ||
      !funds.some((fund) => fund.fundName === prefilledSetupFee.targetFund) ||
      (prefillFund && prefilledSetupFee.targetFund !== prefillFund))
  );

  useEffect(() => {
    if (penaltyId) {
      setFundAllocation(PENALTY_FUND_NAME);
      return;
    }
    if (prefillDesc) {
      // For a collectible, never silently fall back to "Others".
      // The configured fee is authoritative; the server validates it again.
      setFundAllocation(invalidPrefilledFund ? "" : (prefilledSetupFee?.targetFund || ""));
      return;
    }

    if (currentCategoryItems.length === 0) {
      setItemDescription("");
      setFundAllocation("");
      return;
    }

    if (packageItems.length > 1) {
      setItemDescription(DEPARTMENTAL_PACKAGE_NAME);
      setFundAllocation("Multiple Funds (Package Split)");
      return;
    }

    setItemDescription(currentCategoryItems[0].name);
    setFundAllocation(currentCategoryItems[0].targetFund);
  }, [category, currentCategoryItems, packageItems, prefillDesc, funds, penaltyId, prefilledSetupFee, invalidPrefilledFund]);

  const standardRate = useMemo(() => {
    if (penaltyId) return Number(penaltyState?.balance ?? prefillAmount ?? 0);
    if (itemDescription === DEPARTMENTAL_PACKAGE_NAME) return packageTotal;
    const found = currentCategoryItems.find((item) => item.name === itemDescription);
    return found ? Number(found.amount || 0) : (parseFloat(prefillAmount || "") || 0);
  }, [itemDescription, currentCategoryItems, packageTotal, prefillAmount, penaltyId, penaltyState?.balance]);

  const isPenalty = Boolean(penaltyId);
  const balanceReady = Boolean(studentId) && (isPenalty
    ? Boolean(penaltyState)
    : !balanceLoading && !balanceError && creditSnapshot?.studentId === studentId);
  const balancePreview = useMemo(() => {
    if (!balanceReady) return null;
    return calculateCollectionBalancePreview({
      credits: creditSnapshot?.credits ?? [],
      itemDescription,
      standardRate,
      packageItems: itemDescription === DEPARTMENTAL_PACKAGE_NAME ? packageItems : [],
      isPenalty,
      penaltyBalance: penaltyState?.balance ?? null,
      prefillLimit: !isPenalty && prefillDesc && prefillAmount
        ? Number(prefillAmount) : null,
    });
  }, [balanceReady, creditSnapshot, itemDescription, standardRate, packageItems, isPenalty,
    penaltyState?.balance, prefillDesc, prefillAmount]);

  // Full/Balance starts at the remaining payable amount, not the original rate.
  // Partial starts blank rather than inheriting a formerly selected full amount.
  useEffect(() => {
    if (!balancePreview) {
      setAmountPaid("");
    } else if (paymentType === "Full Payment" || paymentType === "Balance") {
      setAmountPaid((balancePreview.payableCents / 100).toFixed(2));
    } else {
      setAmountPaid("");
    }
  }, [studentId, category, itemDescription, paymentType, balancePreview?.payableCents]);

  const paidNowCents = Math.round((Number(amountPaid) || 0) * 100);
  const remainingBalance = balancePreview
    ? Math.max(0, (balancePreview.dueCents - paidNowCents) / 100)
    : 0;
  const cannotPayPenalty = isPenalty && (!penaltyState ||
    /^SETTLED/i.test(penaltyState.status) || /VOID|CANCEL/i.test(penaltyState.status) || penaltyState.balance <= 0);
  const actualPaymentType = remainingBalance === 0 ? "Full Payment" : "Partial Payment";
  const remainingTime = penaltyState?.ratePerHour && penaltyState.ratePerHour > 0
    ? remainingBalance / penaltyState.ratePerHour : 0;

  const handleStudentSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    setStudentId("");
    setStudentName("");
    setStudentEmail("");
    const match = students.find((s) => 
        `${s.fullName} (${s.studentId})`.toLowerCase().includes(val.toLowerCase()) ||
        s.studentId.toLowerCase() === val.toLowerCase() ||
        s.fullName.toLowerCase() === val.toLowerCase()
    );
    if (match) {
      setStudentId(match.studentId);
      setStudentName(match.fullName);
      setStudentEmail(match.email || "");
    }
  };

  const handleItemChange = (itemName: string) => {
    setItemDescription(itemName);
    if (itemName === DEPARTMENTAL_PACKAGE_NAME) {
      setFundAllocation("Multiple Funds (Package Split)");
      return;
    }
    const item = currentCategoryItems.find((i) => i.name === itemName);
    if (item) setFundAllocation(item.targetFund);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (closed) return void clearAlert("This period has been closed by carry-over.");
    if (invalidPrefilledFund) {
      await ThemedAlert.fire({ icon: "error", title: "Fee Setup Mismatch", text: "The selected fee or its destination fund is not configured for this academic term. Return to Fee Setup and correct the allocation before accepting payment." });
      return;
    }
    if (!fundAllocation) {
      await ThemedAlert.fire({ icon: "error", title: "Destination Fund Required", text: "There is no valid destination fund for this receipt." });
      return;
    }
    if (cannotPayPenalty) return void clearAlert("This penalty cannot accept cash yet. A settled legacy record without a receipt must first be reconciled by an administrator in Penalty Logs.");
    const paid = Number(amountPaid);

    if (!studentId) {
      await ThemedAlert.fire({ icon: 'warning', title: 'Student Required', text: 'Please select a valid student.' });
      return;
    }
    if (!Number.isFinite(paid) || paid <= 0 || !Number.isInteger(paidNowCents) ||
        Math.abs(paid * 100 - paidNowCents) > 0.000001) {
      await ThemedAlert.fire({ icon: 'warning', title: 'Invalid Amount', text: 'Please enter a positive amount with no more than two decimal places.' });
      return;
    }
    if (!balanceReady || !balancePreview) {
      await ThemedAlert.fire({ icon: 'warning', title: 'Balance Unavailable', text: 'Wait for the current outstanding balance before recording payment.' });
      return;
    }
    if (paidNowCents > balancePreview.payableCents) {
      await ThemedAlert.fire({ icon: 'warning', title: 'Exceeds Outstanding Balance', text: `Amount paid cannot exceed the current payable balance of ${fmt(balancePreview.payableCents / 100)}. Refresh if another officer has already posted a payment.` });
      return;
    }
    if (paid > standardRate) {
      await ThemedAlert.fire({ icon: 'warning', title: 'Exceeds Rate', text: `Amount paid cannot exceed the standard rate of ${fmt(standardRate)}.` });
      return;
    }

    if (isSubmitting) return;
    const requestPayload = {
      date, studentId, studentName, studentEmail, category, itemDescription,
      paymentType, standardRate: standardRate || paid, amountPaid: paid,
      fundAllocation, ay, term, penaltyId: penaltyId || undefined,
    };
    const signature = JSON.stringify(requestPayload);
    if (!pendingPayment.current || pendingPayment.current.signature !== signature) {
      pendingPayment.current = { signature, requestId: crypto.randomUUID() };
    }
    setIsSubmitting(true);
    try {
      const result = await recordPayment(department, {
        ...requestPayload, requestId: pendingPayment.current.requestId,
      });
      pendingPayment.current = null;

      setReceiptData({
        orNumber: result.orNumber,
        date,
        studentId,
        studentName,
        itemDescription: result.itemDescription,
        amountPaid: paid,
        balanceDue: result.balanceDue,
        paymentType: result.paymentType,
      });

      setAmountPaid("");
      setSearchQuery("");
      setStudentId("");
      setStudentName("");
      setStudentEmail("");


    } catch (err: any) {
      await ThemedAlert.fire({ icon: 'error', title: 'Transaction Failed', text: err?.message || 'Unknown error occurred.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (collectionItems.length === 0 && !prefillDesc) {
    return (
      <div className="alert alert-warning py-3 small">
        <i className="bi bi-exclamation-triangle me-2"></i>
        No collections have been setup for this department yet. Please visit the Setup module to configure fees.
      </div>
    );
  }

  if (receiptData) {
    return (
      <div className="d-flex flex-column align-items-center animation-fade-in text-body">
        <div className="alert alert-success w-100 shadow-sm border-success mb-4 text-center">
          <i className="bi bi-check-circle-fill fs-4 d-block mb-2 text-success"></i>
          <strong>Payment successfully recorded!</strong> Receipt saved and balances updated. Receipt email is sent if delivery is available.
        </div>

        <div id="printable-receipt" className="card border-secondary shadow w-100 bg-body text-body" style={{ maxWidth: '450px' }}>
          <div className="card-body p-4 p-md-5">
            <div className="text-center mb-4 border-bottom border-secondary pb-3">
              <h5 className="fw-bold text-uppercase mb-1">{decodeURIComponent(department)}</h5>
              <div className="text-muted small">Filamer Christian University</div>
              <div className="mt-3 fw-bold fs-5 text-info" style={{ letterSpacing: '2px' }}>OFFICIAL RECEIPT</div>
            </div>

            <div className="d-flex justify-content-between small mb-1">
              <span className="text-muted">OR Number:</span>
              <span className="fw-bold font-monospace fs-6 text-danger">{receiptData.orNumber}</span>
            </div>
            <div className="d-flex justify-content-between small mb-4">
              <span className="text-muted">Date:</span>
              <span className="fw-medium">{formatManilaLongDate(receiptData.date)}</span>
            </div>

            <div className="p-3 rounded mb-4 border border-secondary bg-body-secondary">
              <div className="small text-muted mb-1">Received from:</div>
              <div className="fw-bold fs-6">{receiptData.studentName}</div>
              <div className="small text-muted font-monospace">{receiptData.studentId}</div>
            </div>

            <table className="table table-sm table-borderless mb-4 text-body">
              <thead>
                <tr className="border-bottom border-secondary small text-muted">
                  <th className="px-0">Particulars</th>
                  <th className="px-0 text-end">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-0 py-2 small fw-medium">{receiptData.itemDescription}</td>
                  <td className="px-0 py-2 text-end fw-bold fs-6 text-success">{fmt(receiptData.amountPaid)}</td>
                </tr>
              </tbody>
            </table>

            {typeof receiptData.balanceDue === "number" && (
              <div className="d-flex justify-content-between fw-bold border-top pt-2 mt-2">
                <span>Remaining Due</span><span>{fmt(receiptData.balanceDue)}</span>
              </div>
            )}
            <div className="text-center mt-5 pt-4">
              <div className="border-top border-secondary d-inline-block px-5 pt-2 fw-bold text-uppercase text-muted small">
                Authorized Collecting Officer
              </div>
              <div className="small text-muted mt-1">CLEAR System Automated Receipt</div>
            </div>
          </div>
        </div>

        <div className="d-flex gap-3 mt-4 d-print-none w-100" style={{ maxWidth: '450px' }}>
          <button className="btn btn-outline-secondary fw-bold flex-grow-1" onClick={() => window.print()}>
            <i className="bi bi-printer me-2"></i>Print Receipt
          </button>
          <button className="btn btn-info text-dark fw-bold flex-grow-1" onClick={() => setReceiptData(null)}>
            <i className="bi bi-plus-circle me-2"></i>New Transaction
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="text-body">
      {closed && <div className="alert alert-warning">This period has been carried forward. Payments are disabled until its rollover is reversed.</div>}
      <div className="row g-2 mb-2">
        <div className="col-md-6">
          <label className="form-label text-muted small fw-semibold">Date</label>
          <input type="date" className="form-control bg-body text-body border-secondary" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div className="col-md-6">
          <label className="form-label text-muted small fw-semibold">OR Number</label>
          <div className="form-control bg-body-secondary text-body">Automatically issued after successful payment</div>
        </div>
      </div>

      <div className="mb-2">
        <label className="form-label text-muted small fw-semibold">Search Student (ID or Name)</label>
        <input list="collectionStudentList" className="form-control bg-body text-body border-info" placeholder="Start typing student name or ID..." value={searchQuery} onChange={handleStudentSearch} required />
        <datalist id="collectionStudentList">
          {students.map((s) => (
            <option key={s.studentId} value={`${s.fullName} (${s.studentId})`} />
          ))}
        </datalist>
      </div>

      <div className="row g-2 mb-2">
        <div className="col-md-4">
          <label className="form-label text-muted small fw-semibold">Student ID</label>
          <input type="text" className="form-control bg-body-secondary text-body font-monospace border-secondary" value={studentId} readOnly />
        </div>
        <div className="col-md-4">
          <label className="form-label text-muted small fw-semibold">Full Name</label>
          <input type="text" className="form-control bg-body text-body border-secondary" value={studentName} onChange={(e) => setStudentName(e.target.value)} required />
        </div>
        <div className="col-md-4">
          <label className="form-label text-muted small fw-semibold">Notification Email</label>
          <input type="email" className="form-control bg-body text-body border-secondary" value={studentEmail} onChange={(e) => setStudentEmail(e.target.value)} placeholder="student@example.com" />
        </div>
      </div>

      <div className="mb-2">
        <label className="form-label text-muted small fw-semibold">Collection Category</label>
        {prefillDesc ? (
          <input type="text" className="form-control bg-body-secondary text-body border-secondary fw-semibold" value={category} readOnly />
        ) : (
          <select className="form-select bg-body text-body border-secondary" value={category} onChange={(e) => setCategory(e.target.value)} required>
            {categories.map((cat) => {
              const hasPackageItems = collectionItems.some(i => i.category === cat && i.isPackage === true);
              return (
                <option key={cat} value={cat}>
                  {cat} {hasPackageItems ? " — (Contains Mandatory Items)" : " — (Optional / Standalone)"}
                </option>
              );
            })}
          </select>
        )}
      </div>

      <div className="mb-2">
        <label className="form-label text-muted small fw-semibold">Item Description</label>
        {prefillDesc ? (
          <input type="text" className="form-control bg-body-secondary text-body border-secondary fw-semibold" value={itemDescription} readOnly />
        ) : (
          <select className="form-select bg-body text-body border-secondary" value={itemDescription} onChange={(e) => handleItemChange(e.target.value)} required>
            {packageItems.length > 1 && (
              <option value={DEPARTMENTAL_PACKAGE_NAME}>
                ⭐ {DEPARTMENTAL_PACKAGE_NAME} — {fmt(packageTotal)}
              </option>
            )}
            {currentCategoryItems.map((item) => (
              <option key={item.id} value={item.name}>
                {item.name} ({fmt(item.amount)}) {item.isPackage === false ? " [Optional]" : ""}
              </option>
            ))}
          </select>
        )}
      </div>

      {itemDescription === DEPARTMENTAL_PACKAGE_NAME && !prefillDesc && (
        <div className="alert alert-info py-2 small mb-2 border-info">
          <div className="fw-bold mb-1">Mandatory Clearance Package Breakdown</div>
          <div className="mb-1 text-secondary">This package auto-splits the payment into the following target funds:</div>
          <div className="mt-2">
            {packageItems.map((item) => (
              <div key={item.id} className="d-flex justify-content-between text-info">
                <span>{item.name}</span>
                <span className="fw-semibold">{fmt(item.amount)}</span>
              </div>
            ))}
          </div>
          <hr className="my-2 border-info border-opacity-50" />
          <div className="d-flex justify-content-between fw-bold text-info">
            <span>MANDATORY TOTAL</span>
            <span>{fmt(packageTotal)}</span>
          </div>
        </div>
      )}

      {studentId && !isPenalty && balanceLoading && (
        <div className="alert alert-info py-2 small" role="status">
          Checking previously recorded payments for this student and academic term...
        </div>
      )}
      {studentId && !isPenalty && balanceError && (
        <div className="alert alert-danger py-2 small" role="alert">
          Could not verify the current balance: {balanceError}
          <button type="button" className="btn btn-sm btn-outline-danger ms-2"
            onClick={() => setBalanceRefresh(v => v + 1)}>Retry balance lookup</button>
        </div>
      )}
      {balancePreview && (
        <div className="alert alert-info py-2 small mb-2" role="status">
          {!isPenalty && (
            <div className="d-flex justify-content-between">
              <span>Previously credited payments</span>
              <strong>{fmt(balancePreview.alreadyPaidCents / 100)}</strong>
            </div>
          )}
          <div className="d-flex justify-content-between">
            <span>{isPenalty ? "Outstanding fine before payment" : "Actual outstanding before payment"}</span>
            <strong>{fmt(balancePreview.dueCents / 100)}</strong>
          </div>
          <div className="d-flex justify-content-between">
            <span>Maximum payable now</span>
            <strong>{fmt(balancePreview.payableCents / 100)}</strong>
          </div>
          <div className="d-flex justify-content-between fw-bold border-top border-info mt-1 pt-1">
            <span>Remaining balance after entered payment</span>
            <span>{fmt(remainingBalance)}</span>
          </div>
          <div className="small text-muted mt-1">The server independently validates the final balance at posting time.</div>
        </div>
      )}
      <div className="row g-2 mb-2">
        <div className="col-md-4">
          <label className="form-label text-muted small fw-semibold">Payment Mode</label>
          <select className="form-select bg-body text-body border-secondary" value={isPenalty ? actualPaymentType : paymentType} onChange={(e) => setPaymentType(e.target.value)} disabled={isPenalty} required>
            <option value="Full Payment">Full Payment</option>
            <option value="Partial Payment">Partial Payment / Installment</option>
            <option value="Balance">Balance</option>
          </select>
        </div>
        <div className="col-md-4">
          <label className="form-label text-muted small fw-semibold">Standard Rate (₱)</label>
          <input type="number" step="0.01" className="form-control bg-body-secondary text-body border-secondary" readOnly value={standardRate.toFixed(2)} />
        </div>
        <div className="col-md-4">
          <label className="form-label text-info fw-bold small">Amount Paid Now (₱)</label>
          <input type="number" step="0.01" min="0" className="form-control bg-body text-body border-info fw-bold text-info" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)}
            max={balancePreview ? balancePreview.payableCents / 100 : undefined}
            disabled={!balanceReady || !balancePreview || balancePreview.payableCents <= 0 || isSubmitting}
            required />
        </div>
      </div>

      {parseFloat(amountPaid) > 0 && standardRate > 0 && (isPenalty || (paymentType !== "Full Payment" && !prefillAmount)) && (
        <div className="alert alert-danger py-2 small fw-bold mb-2 border-danger">
          REMAINING BALANCE DUE: {fmt(remainingBalance)}
          {isPenalty && penaltyState && penaltyState.ratePerHour > 0 && (
            <span className="d-block fw-normal">Equivalent remaining service time: {formatHoursAndMinutes(remainingTime)} at {fmt(penaltyState.ratePerHour)}/hr</span>
          )}
        </div>
      )}

      {invalidPrefilledFund && (
        <div className="alert alert-danger py-2 small" role="alert">
          Fee Setup mismatch: this item does not have a valid destination fund for the selected term.
          No payment can be posted until the configured fee is corrected.
        </div>
      )}
      <div className="mb-3">
        <label className="form-label text-muted small fw-semibold">Target Fund Allocation</label>
        {prefillDesc ? (
          <input type="text" className="form-control bg-body-secondary text-body border-secondary" value={fundAllocation} readOnly />
        ) : (
          <select className="form-select bg-body text-body border-secondary" value={fundAllocation} onChange={(e) => setFundAllocation(e.target.value)} required>
            {fundAllocation === "Multiple Funds (Package Split)" && (
              <option value="Multiple Funds (Package Split)">Multiple Funds (Package Split)</option>
            )}
            {funds.map((fund) => (
              <option key={fund.id} value={fund.fundName}>{fund.fundName}</option>
            ))}
          </select>
        )}
      </div>

      <button type="submit" className="btn btn-info fw-bold w-100 text-dark" disabled={isSubmitting || closed || cannotPayPenalty || invalidPrefilledFund || !fundAllocation ||
          !balanceReady || !balancePreview || balancePreview.payableCents <= 0}>
        {isSubmitting ? "Recording Payment..." : "Post Payment"}
      </button>
    </form>
  );
}