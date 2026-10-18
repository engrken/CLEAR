// app/department/[department]/(protected)/collectibles/CollectiblesManager.tsx
"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fmt } from "@/lib/utils";
import { ThemedAlert } from "@/lib/clear-dialogs";
import { assessStudentDue, voidCollectibleAssessment } from "./actions";

type Student = { id: string; studentId: string; fullName: string };
type Fee = {
  id: string;
  category: string;
  name: string;
  amount: number;
  targetFund: string;
  isPackage: boolean;
};
type Collectible = {
  id: string;
  category: string;
  balanceDue: number;
  status: string;
};

type PaymentLine = {
  receiptId: string; orNumber: string; amount: number; date: string;
  status: string; paymentType: string; fund: string; officer: string;
  accountingPeriod: string; source: "Same-Period Match" | "Verified Arrears Link";
};

function isVoidStatus(status: string): boolean { return /VOID|CANCEL/i.test(status); }
function isUnpaid(row: Collectible): boolean {
  return Number(row.balanceDue) > 0 && !isVoidStatus(row.status);
}
function dueState(row: Collectible): "Unpaid" | "Paid" | "Voided" {
  if (isVoidStatus(row.status)) return "Voided";
  if (/^(PAID|SETTLED)/i.test(row.status)) return "Paid";
  return isUnpaid(row) ? "Unpaid" : "Paid";
}

function localToday(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function decodedDue(status: string): { studentId: string; description: string } | null {
  const marker = status.match(/\|SID:([^|]+)\|ITEM:([^|]+)/);
  if (!marker) return null;
  try {
    return {
      studentId: decodeURIComponent(marker[1]),
      description: decodeURIComponent(marker[2]),
    };
  } catch {
    return null;
  }
}

export default function CollectiblesManager({
  department,
  ay,
  term,
  students,
  collectibles,
  collectionItems,
  closed = false,
  canVoidAssessments = false,
  historyByAssessment = {},
  ambiguousAssessmentIds = [],
}: {
  department: string;
  ay: string;
  term: string;
  students: Student[];
  collectibles: Collectible[];
  collectionItems: Fee[];
  closed?: boolean;
  canVoidAssessments?: boolean;
  historyByAssessment?: Record<string, PaymentLine[]>;
  ambiguousAssessmentIds?: string[];
}) {
  const router = useRouter();
  const [dueDate, setDueDate] = useState(localToday);
  const [dueSearch, setDueSearch] = useState("");
  const [studentId, setStudentId] = useState("");
  const [studentName, setStudentName] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedFeeId, setSelectedFeeId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [logSearch, setLogSearch] = useState("");
  const [logStatus, setLogStatus] = useState("Unpaid");
  const [logPageSize, setLogPageSize] = useState(10);
  const [logPage, setLogPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Items originate exclusively from the selected period's CollectionSetup rows.
  // Package fees are handled by the package/clearance flow, not charged twice here.
  const fees = useMemo(
    () => collectionItems.filter((fee) => !fee.isPackage),
    [collectionItems]
  );
  const categories = useMemo(
    () => Array.from(new Set(fees.map((fee) => fee.category))),
    [fees]
  );
  const category = categories.includes(selectedCategory) ? selectedCategory : (categories[0] || "");
  const categoryFees = fees.filter((fee) => fee.category === category);
  const selectedFee = categoryFees.find((fee) => fee.id === selectedFeeId) || categoryFees[0] || null;

  const studentNames = useMemo(() => new Map(students.map(s => [s.studentId.toLowerCase(), s.fullName])), [students]);
  const ambiguous = useMemo(() => new Set(ambiguousAssessmentIds), [ambiguousAssessmentIds]);
  const filteredLog = useMemo(() => collectibles.filter((row) => {
    if (logStatus !== "All" && dueState(row) !== logStatus) return false;
    const marker = decodedDue(row.status);
    const history = historyByAssessment[row.id] || [];
    const corpus = [marker?.studentId, marker ? studentNames.get(marker.studentId.toLowerCase()) : "Summary assessment",
      marker?.description, row.category, row.status, row.id, ...history.map(h => h.orNumber)].join(" ").toLowerCase();
    return corpus.includes(logSearch.trim().toLowerCase());
  }), [collectibles, logStatus, logSearch, historyByAssessment, studentNames]);
  const pageCount = Math.max(1, Math.ceil(filteredLog.length / logPageSize));
  const currentPage = Math.max(1, Math.min(logPage, pageCount));
  const visibleLog = filteredLog.slice((currentPage - 1) * logPageSize, currentPage * logPageSize);
  const outstandingCount = collectibles.filter(isUnpaid).length;

  const voidAssessment = async (row: Collectible) => {
    if (voidingId || closed || !canVoidAssessments || ambiguous.has(row.id)) return;
    const marker = decodedDue(row.status);
    const label = marker ? `${marker.studentId} — ${marker.description}` : `${row.category} (summary assessment)`;
    const answer = await ThemedAlert.fire({
      icon: "warning", title: "Void Outstanding Assessment?",
      text: `This removes the unpaid clearance hold for ${label}, but does not void OR payments. Reverse all related receipts first. Enter an audit reason.`,
      input: "textarea", inputPlaceholder: "Required accounting reason (at least 10 characters)",
      showCancelButton: true, confirmButtonText: "Void Assessment", cancelButtonText: "Cancel",
      inputValidator: (value) => {
        const length = String(value || "").trim().length;
        return length < 10 || length > 500 ? "Provide an audit reason of 10–500 characters." : null;
      },
    });
    if (!answer.isConfirmed) return;
    setVoidingId(row.id);
    try {
      await voidCollectibleAssessment(department, {
        collectibleId: row.id, reason: String(answer.value || "").trim(), ay, term,
      });
      setExpandedId(null);
      setLogSearch("");
      setLogPage(1);
      await ThemedAlert.fire({ icon: "success", title: "Assessment Voided", text: "Outstanding balance and clearance hold removed. Original assessment and void history retained." });
      router.refresh();
    } catch (error) {
      await ThemedAlert.fire({ icon: "error", title: "Void Not Completed", text: error instanceof Error ? error.message : "No records were changed." });
    } finally { setVoidingId(null); }
  };

  const findStudent = (value: string) => {
    setDueSearch(value);
    setStudentId("");
    setStudentName("");
    const needle = value.trim().toLowerCase();
    const match = students.find((student) =>
      student.studentId.toLowerCase() === needle ||
      student.fullName.toLowerCase() === needle ||
      `${student.fullName} (${student.studentId})`.toLowerCase() === needle
    );
    if (match) {
      setStudentId(match.studentId);
      setStudentName(match.fullName);
    }
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    if (closed) {
      await ThemedAlert.fire({ icon: "warning", title: "Period Closed", text: "This term has an active rollover." });
      return;
    }
    if (!studentId || !selectedFee) {
      await ThemedAlert.fire({ icon: "warning", title: "Incomplete Assessment", text: "Select a registered student and a configured standalone fee." });
      return;
    }

    const confirmation = await ThemedAlert.fire({
      icon: "question",
      title: "Assess Student Due?",
      text: `Create an outstanding balance of ${fmt(selectedFee.amount)} for ${studentName}? ` +
        `Item: ${selectedFee.name}. This will place a clearance hold until payment.`,
      showCancelButton: true,
      confirmButtonText: "Confirm Assessment",
    });
    if (!confirmation.isConfirmed) return;

    setSubmitting(true);
    try {
      await assessStudentDue(department, {
        studentId,
        feeId: selectedFee.id,
        date: dueDate,
        ay,
        term,
      });
      await ThemedAlert.fire({
        icon: "success",
        title: "Collectible Recorded",
        text: `${selectedFee.name} (${fmt(selectedFee.amount)}) assessed to ${studentName}.`,
      });
      setDueSearch("");
      setStudentId("");
      setStudentName("");
      setLogSearch("");
      setLogPage(1);
      router.refresh();
    } catch (error) {
      await ThemedAlert.fire({
        icon: "error",
        title: "Assessment Failed",
        text: error instanceof Error ? error.message : "Unable to record the collectible.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const feeSetupUrl = `/department/${encodeURIComponent(department)}/setup/collections?ay=${encodeURIComponent(ay)}&term=${encodeURIComponent(term)}`;

  return (
    <div>
      {closed && (
        <div className="alert alert-warning" role="alert">
          This academic period has been closed by rollover. New assessments are disabled.
        </div>
      )}
      <div className="card p-3 border-info mb-4 shadow-sm bg-body text-body">
        <h6 className="text-info fw-bold mb-1">Assess Activity, Merchandise, or Event Due</h6>
        <p className="text-secondary small mb-3">
          Items and amounts come from <strong>Setup Collection Fees</strong> for {term} ({ay}).
          Mandatory package items are excluded because their requirements are handled in Clearance.
        </p>

        {fees.length === 0 ? (
          <div className="alert alert-info mb-0" role="status">
            No standalone fees are configured for this period. In{" "}
            <Link href={feeSetupUrl} className="alert-link">Setup Collection Fees</Link>,
            create a fee with <strong>Include in mandatory package</strong> unchecked.
            Then return here to assess it to a student.
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="row g-2 mb-2">
              <div className="col-md-6">
                <label htmlFor="due-date" className="form-label text-secondary small fw-semibold">Date</label>
                <input id="due-date" type="date" className="form-control bg-body text-body border-secondary"
                  value={dueDate} onChange={(e) => setDueDate(e.target.value)} required disabled={closed || submitting}/>
              </div>
              <div className="col-md-6">
                <label htmlFor="due-search" className="form-label text-secondary small fw-semibold">Search Student</label>
                <input id="due-search" list="dueStudentList" className="form-control bg-body text-body border-secondary"
                  placeholder="Type name or ID..." value={dueSearch} onChange={(e) => findStudent(e.target.value)}
                  required disabled={closed || submitting}/>
                <datalist id="dueStudentList">
                  {students.map((student) => (
                    <option key={student.studentId} value={`${student.fullName} (${student.studentId})`}/>
                  ))}
                </datalist>
              </div>
            </div>

            <div className="row g-2 mb-2">
              <div className="col-md-6">
                <label className="form-label text-secondary small fw-semibold">Student ID</label>
                <input className="form-control bg-body-secondary text-body font-monospace border-secondary" value={studentId} readOnly />
              </div>
              <div className="col-md-6">
                <label className="form-label text-secondary small fw-semibold">Student Name</label>
                <input className="form-control bg-body-secondary text-body border-secondary" value={studentName} readOnly required />
              </div>
            </div>

            <div className="row g-2 mb-2">
              <div className="col-md-6">
                <label htmlFor="due-category" className="form-label text-secondary small fw-semibold">Category</label>
                <select id="due-category" className="form-select bg-body text-body border-secondary" value={category}
                  onChange={(e) => { setSelectedCategory(e.target.value); setSelectedFeeId(""); }}
                  disabled={closed || submitting} required>
                  {categories.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </div>
              <div className="col-md-6">
                <div className="d-flex align-items-center justify-content-between gap-2 mb-1 flex-wrap">
                  <label htmlFor="due-item" className="form-label text-secondary small fw-semibold mb-0">
                    Item (from Fee Setup)
                  </label>
                  <div className="d-flex align-items-center gap-2">
                    <Link
                      href={feeSetupUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="small text-info fw-semibold text-decoration-none"
                      title="Open Setup Collection Fees in a new tab to add an item"
                    >
                      <i className="bi bi-plus-circle me-1" aria-hidden="true" />Add Item
                      <i className="bi bi-box-arrow-up-right ms-1" aria-hidden="true" />
                    </Link>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary py-0 px-2"
                      onClick={() => router.refresh()}
                      disabled={submitting}
                      title="Reload fee items after adding them in Setup"
                    >
                      <i className="bi bi-arrow-clockwise me-1" aria-hidden="true" />Refresh Items
                    </button>
                  </div>
                </div>
                <select id="due-item" className="form-select bg-body text-body border-secondary"
                  value={selectedFee?.id || ""} onChange={(e) => setSelectedFeeId(e.target.value)}
                  disabled={closed || submitting} required>
                  {categoryFees.map((fee) => (
                    <option key={fee.id} value={fee.id}>{fee.name} ({fmt(fee.amount)})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="row g-2 mb-3">
              <div className="col-md-6">
                <label className="form-label text-secondary small fw-semibold">Amount Due (₱)</label>
                <input className="form-control bg-body-secondary text-body border-secondary"
                  value={selectedFee ? Number(selectedFee.amount).toFixed(2) : ""} readOnly />
                <small className="text-secondary">Controlled by Fee Setup; cannot be overridden here.</small>
              </div>
              <div className="col-md-6">
                <label className="form-label text-secondary small fw-semibold">Fund Allocation Pool</label>
                <input className="form-control bg-body-secondary text-body border-secondary"
                  value={selectedFee?.targetFund || ""} readOnly />
                <small className="text-secondary">Automatically follows the selected fee's destination fund.</small>
              </div>
            </div>

            <button type="submit" className="btn btn-danger fw-bold w-100"
              disabled={closed || submitting || !studentId || !selectedFee}>
              {submitting ? "Assessing..." : "Charge Due & Lock Clearance"}
            </button>
          </form>
        )}
      </div>

      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
        <h6 className="text-secondary fw-bold mb-0">Receivables &amp; Collectibles Log ({outstandingCount} unpaid)</h6>
        <small className="text-secondary">Only officers with Void Center permission can reverse assessments.</small>
      </div>
      <div className="row g-2 mb-3">
        <div className="col-md-6">
          <label htmlFor="collectible-log-search" className="form-label small text-secondary">Search student, fee, category, OR</label>
          <input id="collectible-log-search" type="search" value={logSearch}
            onChange={e => { setLogSearch(e.target.value); setLogPage(1); }}
            placeholder="Name, student ID, item, OR number..." className="form-control bg-body text-body border-secondary" />
        </div>
        <div className="col-6 col-md-3">
          <label htmlFor="collectible-log-status" className="form-label small text-secondary">Status</label>
          <select id="collectible-log-status" className="form-select bg-body text-body border-secondary" value={logStatus}
            onChange={e => { setLogStatus(e.target.value); setLogPage(1); }}>
            {(["Unpaid", "Paid", "Voided", "All"] as const).map(value => <option key={value}>{value}</option>)}
          </select>
        </div>
        <div className="col-6 col-md-3">
          <label htmlFor="collectible-log-size" className="form-label small text-secondary">Rows per page</label>
          <select id="collectible-log-size" className="form-select bg-body text-body border-secondary" value={logPageSize}
            onChange={e => { setLogPageSize(Number(e.target.value)); setLogPage(1); }}>
            {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>
      <div className="table-responsive">
        <table className="table table-sm table-hover align-middle text-body w-100" style={{ fontSize: "0.85rem" }}>
          <thead><tr className="text-secondary border-bottom border-secondary">
            <th>Student</th><th>Category / Description</th><th className="text-end">Balance Due</th>
            <th className="text-center">Status / Actions</th>
          </tr></thead>
          <tbody>
            {visibleLog.length === 0 ? (
              <tr><td colSpan={4} className="text-center text-secondary py-4">No matching assessments.</td></tr>
            ) : visibleLog.map((row) => {
              const marker = decodedDue(row.status);
              const history = historyByAssessment[row.id] || [];
              const state = dueState(row);
              const isExpanded = expandedId === row.id;
              return (
                <React.Fragment key={row.id}>
                  <tr className="border-bottom border-secondary">
                    <td className="py-2">
                      <strong className="d-block">{marker ? studentNames.get(marker.studentId.toLowerCase()) || "Student" : "Summary assessment"}</strong>
                      <small className="text-secondary font-monospace">{marker?.studentId || "Not student-linked"}</small>
                    </td>
                    <td className="py-2">
                      <strong>{marker?.description || row.category}</strong>
                      <div className="text-secondary small">{row.category}</div>
                      {ambiguous.has(row.id) && <small className="text-warning">Duplicate fee identity: reconciliation required</small>}
                    </td>
                    <td className="py-2 text-end fw-semibold">{fmt(row.balanceDue)}</td>
                    <td className="py-2 text-center" style={{ minWidth: 165 }}>
                      <span className={`badge ${state === "Voided" ? "bg-secondary" : state === "Paid" ? "bg-success" : "bg-danger"}`}>{state}</span>
                      <div className="d-flex flex-wrap justify-content-center gap-1 mt-1">
                        {marker && state === "Unpaid" && !closed && (
                          <Link className="btn btn-sm btn-outline-info" href={
                            `/department/${encodeURIComponent(department)}/collections` +
                            `?ay=${encodeURIComponent(ay)}&term=${encodeURIComponent(term)}` +
                            `&collectibleId=${encodeURIComponent(row.id)}`
                          }>Record Payment</Link>
                        )}
                        <button type="button" className="btn btn-sm btn-outline-secondary"
                          aria-expanded={isExpanded}
                          onClick={() => setExpandedId(isExpanded ? null : row.id)}>
                          {isExpanded ? "Hide History" : `History (${history.length})`}
                        </button>
                        {canVoidAssessments && state === "Unpaid" && !closed && (
                          <button type="button" className="btn btn-sm btn-outline-danger"
                            title={ambiguous.has(row.id) ? "Duplicate assessment identity. Reconcile first." : "Void unpaid assessment after reversing related OR payments"}
                            disabled={Boolean(voidingId) || ambiguous.has(row.id) || submitting}
                            onClick={() => void voidAssessment(row)}>
                            {voidingId === row.id ? "Voiding..." : "Void"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {isExpanded && <tr className="border-bottom border-secondary"><td colSpan={4} className="p-3 bg-body-tertiary">
                    <strong className="d-block mb-2">Cash payment and OR history</strong>
                    {ambiguous.has(row.id) && <p className="text-warning small mb-2">Multiple assessments share this fee identity. Same-period receipts cannot be safely attributed to a single assessment.</p>}
                    {history.length === 0 ? <p className="small text-secondary mb-0">No uniquely matching posted receipt or linked arrears payment found. Older payments without an identifiable link require reconciliation.</p> :
                      <div className="table-responsive"><table className="table table-sm text-body mb-0">
                        <thead><tr><th>Transaction Date / Period</th><th>OR Number</th><th>Payment Method / Status</th><th>Fund / Processed By</th><th className="text-end">Amount</th></tr></thead>
                        <tbody>{history.map(h => <tr key={h.receiptId}>
                          <td>{h.date.slice(0, 10)}<div className="small text-secondary">{h.accountingPeriod}</div></td>
                          <td className="font-monospace">{h.orNumber}<div className="small text-secondary">{h.source === "Verified Arrears Link" ? "Linked historical payment" : "Matched by student / item"}</div></td>
                          <td>{h.paymentType}<div className={isVoidStatus(h.status) ? "text-danger small" : "text-success small"}>{h.status}</div></td>
                          <td>{h.fund}<div className="text-secondary small">{h.officer}</div></td>
                          <td className="text-end">{fmt(h.amount)}</td>
                        </tr>)}</tbody>
                      </table></div>}
                    <small className="text-secondary d-block mt-2">Voided ORs remain in the audit history but do not count as active payments. Same-period receipts use a legacy identity match; historical arrears use an explicit receipt link.</small>
                  </td></tr>}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-2">
        <small className="text-secondary">
          Showing {filteredLog.length === 0 ? 0 : (currentPage - 1) * logPageSize + 1}–{Math.min(filteredLog.length, currentPage * logPageSize)} of {filteredLog.length}
        </small>
        <div className="btn-group" role="group" aria-label="Collectibles log pages">
          <button type="button" className="btn btn-sm btn-outline-secondary" disabled={currentPage <= 1}
            onClick={() => setLogPage(1)}>First</button>
          <button type="button" className="btn btn-sm btn-outline-secondary" disabled={currentPage <= 1}
            onClick={() => setLogPage(currentPage - 1)}>Previous</button>
          <span className="btn btn-sm btn-outline-secondary disabled" aria-live="polite">{currentPage} / {pageCount}</span>
          <button type="button" className="btn btn-sm btn-outline-secondary" disabled={currentPage >= pageCount}
            onClick={() => setLogPage(currentPage + 1)}>Next</button>
          <button type="button" className="btn btn-sm btn-outline-secondary" disabled={currentPage >= pageCount}
            onClick={() => setLogPage(pageCount)}>Last</button>
        </div>
      </div>
    </div>
  );
}
