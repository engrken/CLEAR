// /app/department/[department]/(protected)/penalties/PenaltiesManager.tsx

"use client";
import { manilaDateInput, formatManilaDateTime24 } from '@/lib/clear-timezone';
import { clearAlert, clearConfirm, clearPrompt } from "@/lib/clear-dialogs";


import { useState, useMemo } from "react";
import { fmt, formatHoursAndMinutes } from "@/lib/utils";
import {
  recordPenalty,
  settlePenaltyCommunityService,
  reconcileLegacyCashSettlement,
  deletePenalty
} from "./actions";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Student {
  studentId: string;
  fullName: string;
  email: string | null;
}

interface Penalty {
  id: string;
  penaltyId: string;
  date: Date | string;
  studentId: string | null;
  studentName: string;
  activity: string;
  hoursLate: number;
  ratePerHour: number;
  fineAmount: number;
  status: string;
  penaltyType: string;
  assessedAmount: number | null;
}

type PenaltyHistoryEntry = {
  id: string;
  date: string;
  method: string;
  amount: number;
  minutesRendered: number;
  orNumber: string;
  accountingPeriod: string;
  recordedBy: string;
  note: string;
};

export default function PenaltiesManager({
  department,
  historyByPenalty = {},
  ay,
  term,
  students,
  penalties,
  canVoid = false,
  canReconcile = false,
  periodClosed = false
}: {
  department: string;
  historyByPenalty?: Record<string, PenaltyHistoryEntry[]>;
  ay: string;
  term: string;
  students: Student[];
  penalties: Penalty[];
  canVoid?: boolean;
  canReconcile?: boolean;
  periodClosed?: boolean;
}) {
  const router = useRouter();
  const todayStr = manilaDateInput();

  // =========================================================
  // FORM STATE
  // =========================================================
  const [date, setDate] = useState(todayStr);
  const [searchQuery, setSearchQuery] = useState("");
  const [studentId, setStudentId] = useState("");
  const [studentName, setStudentName] = useState("");
  const [activity, setActivity] = useState("");
  const [hours, setHours] = useState<number>(0);
  const [minutes, setMinutes] = useState<number>(0);
  const [ratePerHour, setRatePerHour] = useState<number>(50.00);
  const [penaltyType, setPenaltyType] = useState<"SERVICE_ELIGIBLE" | "LATE_FEE">("SERVICE_ELIGIBLE");
  const [lateFeeAmount, setLateFeeAmount] = useState<number>(0);
  const [historyPenaltyId, setHistoryPenaltyId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // =========================================================
  // PENALTY LOG MODAL STATE & FILTERS
  // =========================================================
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [logSearch, setLogSearch] = useState(""); 
  const [statusFilter, setStatusFilter] = useState("All"); 

  // =========================================================
  // PAGINATION STATE
  // =========================================================
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Filter penalties based on search & status
  const filteredPenalties = useMemo(() => {
    return penalties.filter(p => {
      if (/VOID|CANCEL/i.test(p.status || "")) return false;
      const matchesSearch = 
        p.studentName.toLowerCase().includes(logSearch.toLowerCase()) || 
        (p.studentId && p.studentId.toLowerCase().includes(logSearch.toLowerCase())) ||
        p.activity.toLowerCase().includes(logSearch.toLowerCase());

      const isUnsettled = Number(p.fineAmount) > 0 && !/^SETTLED/i.test(p.status || "");
      const isSettled = !isUnsettled;

      if (statusFilter === "Unsettled" && !isUnsettled) return false;
      if (statusFilter === "Settled" && !isSettled) return false;

      return matchesSearch;
    });
  }, [penalties, logSearch, statusFilter]);

  const totalPages = Math.ceil(filteredPenalties.length / pageSize) || 1;

  const effectivePage = Math.min(currentPage, totalPages);
  const paginatedPenalties = filteredPenalties.slice(
    (effectivePage - 1) * pageSize,
    effectivePage * pageSize
  );

  // =========================================================
  // COMMUNITY SERVICE MODAL STATE
  // =========================================================
  const [selectedPenalty, setSelectedPenalty] = useState<Penalty | null>(null);
  const [csHours, setCsHours] = useState<number>(0);
  const [csMinutes, setCsMinutes] = useState<number>(0);
  const [isSubmittingCs, setIsSubmittingCs] = useState(false);

  // =========================================================
  // DYNAMIC FINE CALCULATION
  // =========================================================
  const totalHours = hours + minutes / 60;
  const totalFine = penaltyType === "LATE_FEE"
    ? lateFeeAmount
    : Math.round(totalHours * ratePerHour * 100) / 100;

  // =========================================================
  // COMMUNITY SERVICE CALCULATIONS
  // =========================================================
  const csRenderedHours = csHours + csMinutes / 60;
  const activeRate = selectedPenalty ? Number(selectedPenalty.ratePerHour) : ratePerHour;
  const maxServiceMinutes = selectedPenalty && activeRate > 0
    ? Math.ceil(Number(selectedPenalty.fineAmount) * 60 / activeRate)
    : 0;

  const csDeduction = selectedPenalty
    ? Math.min(selectedPenalty.fineAmount, Math.round(csRenderedHours * activeRate * 100) / 100)
    : 0;

  const csRemainingFine = selectedPenalty
    ? Math.max(0, Math.round((selectedPenalty.fineAmount - csDeduction) * 100) / 100)
    : 0;

  // The database retains original assessed hours; live service equivalence
  // comes from the current outstanding balance (which may include cash credits).
  const csRemainingHours = activeRate > 0
    ? Math.max(0, csRemainingFine / activeRate)
    : 0;

  // =========================================================
  // AUTO-FILL STUDENT
  // =========================================================
  const handleStudentSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);

    const match = students.find(
      (s) =>
        `${s.fullName} (${s.studentId})`.toLowerCase() === val.toLowerCase() ||
        s.studentId.toLowerCase() === val.toLowerCase() ||
        s.fullName.toLowerCase() === val.toLowerCase()
    );

    if (match) {
      setStudentId(match.studentId);
      setStudentName(match.fullName);
    } else {
      setStudentId("");
      setStudentName("");
    }
  };

  // =========================================================
  // DELETE / VOID PENALTY
  // =========================================================
  const handleDeletePenalty = async (id: string, name: string) => {
    if (!canVoid || periodClosed) return;
    const reason = await clearPrompt(`Enter the mandatory reason for voiding the penalty for ${name}:`);
    if (reason === null) return;
    if (reason.trim().length < 5) {
      void clearAlert("A void reason of at least five characters is required.");
      return;
    }
    if (!await clearConfirm(`Void this penalty without deleting its audit history?\nReason: ${reason}`)) return;

    try {
      await deletePenalty(department, id, reason.trim());
      void clearAlert("Penalty voided. Its audit record has been retained.");
      setLogSearch("");
      setCurrentPage(1);
      router.refresh(); 
    } catch (err: any) {
      void clearAlert("Error: " + err.message);
    }
  };

  // =========================================================
  // SUBMIT NEW PENALTY
  // =========================================================
  const handleSubmitPenalty = async (e: React.FormEvent) => {
    e.preventDefault();

    if (periodClosed) return void clearAlert("This term has been carried over and is closed for new penalties.");
    const validFlatFee = Number.isFinite(lateFeeAmount) && lateFeeAmount > 0 &&
      Number.isSafeInteger(Math.round(lateFeeAmount * 100)) &&
      Math.abs(lateFeeAmount * 100 - Math.round(lateFeeAmount * 100)) < 0.00001;
    const validServiceAssessment = totalHours > 0 && Number.isInteger(hours) &&
      Number.isInteger(minutes) && minutes >= 0 && minutes <= 59 && ratePerHour > 0;
    if (!studentId || !activity.trim() || !(penaltyType === "LATE_FEE" ? validFlatFee : validServiceAssessment)) {
      return void clearAlert("Select a registered student and enter a valid assessment for the selected penalty type.");
    }

    setIsSubmitting(true);

    try {
      await recordPenalty(department, {
        date,
        studentId,
        studentName,
        activity,
        hoursLate: totalHours,
        ratePerHour,
        fineAmount: totalFine,
        penaltyType,
        fixedAmount: penaltyType === "LATE_FEE" ? lateFeeAmount : undefined,
        ay,
        term
      });

      void clearAlert(`${penaltyType === "LATE_FEE" ? "Late fee" : "Service-eligible penalty"} of ${fmt(totalFine)} recorded for ${studentName}.`);

      setSearchQuery("");
      setStudentId("");
      setStudentName("");
      setActivity("");
      setHours(0);
      setMinutes(0);
      setLateFeeAmount(0);
      setLogSearch("");
      setCurrentPage(1);
      router.refresh();
    } catch (err: any) {
      void clearAlert("Error: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openCsModal = (p: Penalty) => {
    if (p.penaltyType === "LATE_FEE") {
      void clearAlert("Late Fees must be paid in cash. Community service is not permitted.");
      return;
    }
    setSelectedPenalty(p);
    // Do not default to a full settlement; officers must enter work actually rendered.
    setCsHours(0);
    setCsMinutes(0);
  };

  const handleCommunityServiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (periodClosed) return void clearAlert("This term is closed by a carry-over.");
    if (!selectedPenalty || selectedPenalty.penaltyType === "LATE_FEE" || csRenderedHours <= 0 || !Number.isInteger(csHours) ||
        !Number.isInteger(csMinutes) || csMinutes < 0 || csMinutes > 59 ||
        Math.round(csRenderedHours * 60) > maxServiceMinutes) {
      return void clearAlert(`Enter whole service hours/minutes, no more than ${maxServiceMinutes} minutes equivalent of the outstanding balance.`);
    }

    const isFullySettled = csRenderedHours >= selectedPenalty.hoursLate || csDeduction >= selectedPenalty.fineAmount;

    const confirmMsg = isFullySettled
      ? `Student rendered ${formatHoursAndMinutes(csRenderedHours)} (${fmt(csDeduction)} deduction).\n\nThis will FULLY SETTLE the penalty and clear the hold for ${selectedPenalty.studentName}.\n\nProceed?`
      : `Student rendered ${formatHoursAndMinutes(csRenderedHours)} (${fmt(csDeduction)} deduction).\n\nRemaining: ${formatHoursAndMinutes(csRemainingHours)} (${fmt(csRemainingFine)}).\n\nProceed?`;

    if (!await clearConfirm(confirmMsg)) return;

    setIsSubmittingCs(true);
    try {
      await settlePenaltyCommunityService(department, {
        penaltyId: selectedPenalty.penaltyId,
        hoursRendered: csRenderedHours,
        ay,
        term
      });

      void clearAlert("Community service credit successfully applied!");
      setSelectedPenalty(null);
      setLogSearch("");
      setCurrentPage(1);
      router.refresh();
    } catch (err: any) {
      void clearAlert("Error: " + err.message);
    } finally {
      setIsSubmittingCs(false);
    }
  };


  const handleReconcileLegacyCash = async (p: Penalty) => {
    if (!canReconcile || periodClosed) return;
    const originalAssessment = Math.round(Number(p.hoursLate) * Number(p.ratePerHour) * 100) / 100;
    const amountText = await clearPrompt(
      `LEGACY CASH SETTLEMENT RECONCILIATION\n\nPenalty ${p.penaltyId} (${p.studentName}) is marked paid without a verified receipt.\nOriginal assessment: ${fmt(originalAssessment)}.\n\nAfter verifying the cash ledger and student record, enter the ACTUAL outstanding fine (not money already collected):`,
      { defaultValue: originalAssessment.toFixed(2) },
    );
    if (amountText === null) return;
    const amount = Number(amountText);
    if (!Number.isFinite(amount) || amount <= 0 || amount > originalAssessment) {
      void clearAlert("Enter a positive outstanding amount not exceeding the original assessment.");
      return;
    }
    const reason = await clearPrompt("Document why the existing cash settlement is incorrect and what receipt/cash records you checked (minimum 20 characters):");
    if (reason === null) return;
    if (reason.trim().length < 20) return void clearAlert("A detailed audit justification of at least 20 characters is required.");
    if (!await clearConfirm(`Confirm that no money or community-service credit will be counted twice?\n\nReopen ${p.penaltyId} with ${fmt(amount)} outstanding. No receipt will be created by this correction.\n\nReason: ${reason}`)) return;
    try {
      await reconcileLegacyCashSettlement(department, {
        penaltyId: p.penaltyId, ay, term, restoredBalance: amount,
        reason: reason.trim(),
      });
      void clearAlert("Reconciliation recorded. Reopen this penalty from Penalty Logs and post the actual payment in Collections.");
      setLogSearch("");
      setCurrentPage(1);
      router.refresh();
    } catch (error: unknown) {
      void clearAlert(error instanceof Error ? error.message : "Reconciliation failed.");
    }
  };

  const closeLogs = () => {
    setIsLogsOpen(false);
    setCurrentPage(1);
  };

  return (
    <>
      {periodClosed && (
        <div className="alert alert-warning border-warning small">
          This accounting term has been carried over. New penalties, community-service settlements, and voids are disabled until the rollover is reversed.
        </div>
      )}

      {/* =====================================================
          NEW PENALTY FORM
      ====================================================== */}
      <form onSubmit={handleSubmitPenalty} className="mb-4 card p-3 border-secondary bg-body shadow-sm text-body">
        <h6 className="text-info fw-bold mb-3">
          <i className="bi bi-plus-circle me-2"></i>Log New Penalty Infraction
        </h6>
        <fieldset disabled={periodClosed} className="border-0 p-0 m-0">

        <div className="row g-2 mb-2">
          <div className="col-md-6">
            <label className="form-label text-muted small fw-semibold">Date of Activity</label>
            <input type="date" className="form-control bg-body text-body border-secondary" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>

          <div className="col-md-6">
            <label className="form-label text-muted small fw-semibold">Search Student</label>
            <input list="penaltyStudentList" className="form-control bg-body text-body border-secondary" placeholder="Search student name or ID..." value={searchQuery} onChange={handleStudentSearch} required />
            <datalist id="penaltyStudentList">
              {students.map((s) => (
                <option key={s.studentId} value={`${s.fullName} (${s.studentId})`} />
              ))}
            </datalist>
          </div>
        </div>

        <div className="row g-2 mb-2">
          <div className="col-md-4">
            <label className="form-label text-muted small fw-semibold">Student ID</label>
            <input type="text" className="form-control bg-body-secondary text-body font-monospace border-secondary" value={studentId} readOnly />
          </div>

          <div className="col-md-8">
            <label className="form-label text-muted small fw-semibold">Full Name</label>
            <input type="text" className="form-control bg-body-secondary text-body border-secondary" value={studentName} readOnly required />
          </div>
        </div>

        <div className="row g-2 mb-3">
          <div className="col-md-6">
            <label className="form-label text-muted small fw-semibold">Penalty Type</label>
            <select className="form-select bg-body text-body border-secondary" value={penaltyType}
              onChange={e => setPenaltyType(e.target.value as "SERVICE_ELIGIBLE" | "LATE_FEE")}
              disabled={periodClosed}>
              <option value="SERVICE_ELIGIBLE">Community-Service Eligible (Cash or Service)</option>
              <option value="LATE_FEE">Late Fee (Cash Only)</option>
            </select>
          </div>
          <div className="col-md-6">
            <label className="form-label text-muted small fw-semibold">Activity / Reason</label>
            <input type="text" className="form-control bg-body text-body border-secondary" placeholder="e.g. Late enrollment" value={activity} onChange={e => setActivity(e.target.value)} required />
          </div>
        </div>
        {penaltyType === "LATE_FEE" ? (
          <div className="row g-2 mb-3">
            <div className="col-md-6">
              <label className="form-label small fw-semibold text-muted">Fixed Late Fee (₱)</label>
              <input type="number" step="0.01" min="0.01" className="form-control bg-body text-body border-secondary"
                value={lateFeeAmount || ""} onChange={e => setLateFeeAmount(Number(e.target.value) || 0)} required />
            </div>
            <div className="col-md-6 align-self-end small text-muted">
              This is a flat financial assessment. It cannot be settled through community service.
            </div>
          </div>
        ) : (
        <div className="row g-2 mb-3">
          <div className="col-md-4">
            <label className="form-label text-muted small fw-semibold">Hours / Rate Policy</label>
            <div className="small text-muted">Service conversion permitted</div>
          </div>
          <div className="col-md-3">
            <label className="form-label text-muted small fw-semibold">Hours Late</label>
            <input type="number" min="0" className="form-control bg-body text-body border-secondary" value={hours} onChange={(e) => setHours(parseFloat(e.target.value) || 0)} required />
          </div>

          <div className="col-md-3">
            <label className="form-label text-muted small fw-semibold">Minutes Late</label>
            <input type="number" min="0" max="59" className="form-control bg-body text-body border-secondary" value={minutes} onChange={(e) => setMinutes(parseFloat(e.target.value) || 0)} required />
          </div>

          <div className="col-md-2">
            <label className="form-label text-muted small fw-semibold">Rate / hr (₱)</label>
            <input type="number" step="0.01" min="0" className="form-control bg-body text-body border-secondary" value={ratePerHour} onChange={(e) => setRatePerHour(parseFloat(e.target.value) || 0)} required />
          </div>
        </div>
        )}

        <div className="alert border-warning bg-warning bg-opacity-10 text-warning py-2 mb-3 d-flex justify-content-between align-items-center shadow-sm">
          <span className="small fw-bold">{penaltyType === "LATE_FEE" ? "LATE FEE — CASH ONLY" : `COMPUTED FINE (${formatHoursAndMinutes(totalHours)} @ ₱${ratePerHour}/hr)`}</span>
          <span className="fs-5 fw-bold text-danger">{fmt(totalFine)}</span>
        </div>

        <button type="submit" className="btn btn-danger fw-bold w-100 text-white" disabled={isSubmitting}>
          {isSubmitting ? "Logging..." : "Log Official Penalty"}
        </button>
        </fieldset>
      </form>

      {/* =====================================================
          PENALTY LOG BUTTON
      ====================================================== */}
      <div className="card border-secondary bg-body shadow-sm p-3 text-body">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2">
          <div>
            <h6 className="fw-bold text-info mb-1">Penalty Records</h6>
            <p className="text-muted small mb-0">
              {penalties.length === 0 ? "No active or settled penalty records for this term." : `${penalties.length} non-voided penalty record${penalties.length === 1 ? "" : "s"} for this term.`}
            </p>
          </div>

          <button type="button" className="btn btn-outline-info fw-bold" onClick={() => { setCurrentPage(1); setIsLogsOpen(true); }}>
            <i className="bi bi-journal-text me-2"></i>Penalty Logs
            <span className="badge bg-info text-dark ms-2">{penalties.length}</span>
          </button>
        </div>
      </div>

      {/* =====================================================
          PENALTY LOGS MODAL
      ====================================================== */}
      {isLogsOpen && (
        <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true" style={{ backgroundColor: "rgba(0,0,0,0.7)", zIndex: 1055 }}>
          <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable" style={{ maxWidth: "96%" }}>
            <div className="modal-content card border-secondary bg-body text-body shadow-lg clear-theme-modal">

              {/* MODAL HEADER */}
              <div className="modal-header border-secondary">
                <div>
                  <h5 className="modal-title text-info fw-bold mb-1">
                    <i className="bi bi-journal-text me-2"></i>Penalty Logs
                  </h5>
                  <small className="text-muted">Logged penalties for {ay} • {term}</small>
                </div>
                <button type="button" className="btn-close" aria-label="Close" onClick={closeLogs}></button>
              </div>

              {/* MODAL BODY */}
              <div className="modal-body">

                {/* SUMMARY STATS */}
                <div className="row g-2 mb-3">
                  <div className="col-md-4">
                    <div className="border border-secondary rounded p-2 bg-body-secondary">
                      <div className="text-muted small">Total Records</div>
                      <div className="fs-5 fw-bold text-info">{penalties.length}</div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="border border-secondary rounded p-2 bg-body-secondary">
                      <div className="text-muted small">Unsettled / Active Holds</div>
                      <div className="fs-5 fw-bold text-danger">
                        {penalties.filter(p => Number(p.fineAmount) > 0 && !/^SETTLED/i.test(p.status || "")).length}
                      </div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="border border-secondary rounded p-2 bg-body-secondary">
                      <div className="text-muted small">Total Outstanding Fines</div>
                      <div className="fs-5 fw-bold text-warning">{fmt(penalties.reduce((sum, p) => sum + (p.fineAmount || 0), 0))}</div>
                    </div>
                  </div>
                </div>

                {/* SEARCH & FILTER BAR */}
                <div className="row g-2 mb-3">
                  <div className="col-md-8">
                    <div className="input-group input-group-sm">
                      <span className="input-group-text bg-body-secondary border-secondary text-muted"><i className="bi bi-search"></i></span>
                      <input 
                        type="text" 
                        className="form-control bg-body text-body border-secondary" 
                        placeholder="Search student name, ID, or activity..." 
                        value={logSearch} 
                        onChange={e => { setLogSearch(e.target.value); setCurrentPage(1); }} 
                      />
                    </div>
                  </div>
                  <div className="col-md-4">
                    <select 
                      className="form-select form-select-sm bg-body text-body border-secondary" 
                      value={statusFilter} 
                      onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                    >
                      <option value="All">Filter Status: All Records</option>
                      <option value="Unsettled">Unsettled Only</option>
                      <option value="Settled">Settled Only</option>
                    </select>
                  </div>
                </div>

                {/* LOG TABLE */}
                <div className="table-responsive">
                  <table className="table table-sm table-hover align-middle text-body border-secondary w-100" style={{ fontSize: "0.85rem" }}>
                    <thead>
                      <tr className="text-muted border-bottom border-secondary">
                        <th className="py-2">Date</th>
                        <th className="py-2">Student</th>
                        <th className="py-2">Activity</th>
                        <th className="py-2">Type / Duration</th>
                        <th className="py-2">Rate</th>
                        <th className="py-2 text-end">Fine</th>
                        <th className="py-2">Status</th>
                        <th className="py-2 text-center" style={{ minWidth: "115px" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedPenalties.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center text-muted py-5">
                            <i className="bi bi-journal-x fs-2 d-block mb-2 opacity-50"></i>
                            No penalty records found matching criteria.
                          </td>
                        </tr>
                      ) : (
                        paginatedPenalties.map((p) => {
                          const isUnsettled = Number(p.fineAmount) > 0 && !/^SETTLED/i.test(p.status || "");
                          return (
                            <tr key={p.id} className="border-bottom border-secondary">
                              <td className="text-muted py-2">{manilaDateInput(p.date)}</td>
                              <td className="py-2">
                                <strong className="d-block text-truncate" style={{ maxWidth: "200px" }} title={p.studentName}>{p.studentName}</strong>
                                <span className="text-muted font-monospace" style={{ fontSize: "0.75rem" }}>{p.studentId || "N/A"}</span>
                              </td>
                              <td className="py-2 text-truncate" style={{ maxWidth: "180px" }} title={p.activity}>{p.activity}</td>
                              <td className="py-2">
                                <span className={`badge ${p.penaltyType === "LATE_FEE" ? "bg-warning text-dark" : "bg-body-secondary border border-secondary text-info"} px-1 py-0`}>
                                  {p.penaltyType === "LATE_FEE" ? "Late Fee · Cash Only" : formatHoursAndMinutes(p.hoursLate)}
                                </span>
                                {isUnsettled && p.penaltyType !== "LATE_FEE" && p.ratePerHour > 0 && (
                                  <small className="d-block text-warning mt-1">Due equivalent: {formatHoursAndMinutes(p.fineAmount / p.ratePerHour)}</small>
                                )}
                              </td>
                              <td className="py-2 text-muted">{p.penaltyType === "LATE_FEE" ? "Flat" : `₱${p.ratePerHour}/hr`}</td>
                              <td className="py-2 text-end text-danger fw-bold">{fmt(p.fineAmount)}</td>
                              <td className="py-2">
                                <span className={`badge px-1 py-1 ${!isUnsettled ? "bg-success text-white" : "bg-danger text-white"}`} style={{ fontSize: "0.7rem" }}>
                                  {p.status}
                                </span>
                              </td>
                              <td className="py-2 text-center" style={{ minWidth: "115px" }}>
                                <div className="d-flex flex-column gap-1 w-100">
                                  {isUnsettled && !periodClosed && (
                                    <>
                                      <Link
  href={`/department/${encodeURIComponent(department)}/collections?ay=${encodeURIComponent(ay)}&term=${encodeURIComponent(term)}&prefillId=${encodeURIComponent(p.studentId || "")}&penaltyId=${encodeURIComponent(p.penaltyId)}&prefillCategory=Others&prefillDesc=${encodeURIComponent(`Penalty Fine: ${p.activity}`)}&prefillAmount=${p.fineAmount}`}
  className="btn btn-outline-info btn-xs py-0 w-100 text-center fw-semibold"
  style={{ fontSize: "0.75rem" }}
  onClick={() => setIsLogsOpen(false)}
>
  Pay in Cash
</Link>
                                      {p.penaltyType !== "LATE_FEE" && <button
                                        type="button"
                                        className="btn btn-outline-warning btn-xs py-0 w-100 text-center fw-semibold"
                                        style={{ fontSize: "0.75rem" }}
                                        onClick={() => openCsModal(p)}
                                      >
                                        Community Service
                                      </button>}
                                    </>
                                  )}
                                  <button type="button" className="btn btn-outline-info btn-xs py-0 w-100 fw-semibold"
                                    style={{ fontSize: "0.75rem" }} onClick={() => setHistoryPenaltyId(p.id)}>
                                    Transaction History
                                  </button>
                                  {canReconcile && !periodClosed && /^SETTLED\s*\(CASH PAYMENT/i.test(p.status || "") && Number(p.fineAmount) === 0 && (
                                    <button type="button" className="btn btn-outline-warning btn-xs py-1 w-100 small"
                                      onClick={() => void handleReconcileLegacyCash(p)}>
                                      Reconcile Old Cash Status
                                    </button>
                                  )}
                                  {canVoid && !periodClosed && (
                                    <button
                                      type="button"
                                      className="btn btn-outline-danger btn-xs py-0 w-100 text-center fw-semibold"
                                      style={{ fontSize: "0.75rem" }}
                                      onClick={() => handleDeletePenalty(p.id, p.studentName)}
                                      title="Audited penalty void (requires Void Center permission)"
                                    >
                                      Void Penalty
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* =================================================
                  PAGINATION WITH FIRST & LAST PAGE BUTTONS
              ================================================== */}
              {totalPages > 1 && (
                <div className="modal-footer border-secondary d-flex justify-content-between align-items-center flex-wrap gap-2 bg-body-secondary">
                  <div className="d-flex gap-1">
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm px-2"
                      onClick={() => setCurrentPage(1)}
                      disabled={effectivePage === 1}
                      title="First Page"
                    >
                      <i className="bi bi-chevron-double-left"></i> First
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm px-2"
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={effectivePage === 1}
                    >
                      <i className="bi bi-chevron-left me-1"></i> Prev
                    </button>
                  </div>

                  <div className="d-flex align-items-center gap-1 flex-wrap justify-content-center">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(num => num === 1 || num === totalPages || (num >= currentPage - 1 && num <= currentPage + 1))
                      .map((num, idx, arr) => {
                        return (
                          <span key={num} className="d-flex align-items-center">
                            {idx > 0 && arr[idx - 1] !== num - 1 && <span className="text-muted px-1">...</span>}
                            <button
                              type="button"
                              className={`btn btn-sm px-2 py-1 fw-bold ${currentPage === num ? "btn-info text-dark" : "btn-outline-secondary text-body"}`}
                              onClick={() => setCurrentPage(num)}
                            >
                              {num}
                            </button>
                          </span>
                        );
                      })}
                  </div>

                  <div className="d-flex gap-1">
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm px-2"
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={effectivePage === totalPages}
                    >
                      Next <i className="bi bi-chevron-right ms-1"></i>
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm px-2"
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={effectivePage === totalPages}
                      title="Last Page"
                    >
                      Last <i className="bi bi-chevron-double-right"></i>
                    </button>
                  </div>
                </div>
              )}

              {/* CLOSE BUTTON */}
              <div className="px-3 pb-3 bg-body-secondary">
                <button type="button" className="btn btn-secondary btn-sm w-100 fw-bold" onClick={closeLogs}>
                  Close Penalty Logs
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          TRANSACTION HISTORY — includes reversals, not just positive payments
      ====================================================== */}
      {historyPenaltyId && (() => {
        const active = penalties.find(p => p.id === historyPenaltyId);
        if (!active) return null;
        const rows = historyByPenalty[active.id] || [];
        return (
          <div className="modal fade show d-block" role="dialog" aria-modal="true" tabIndex={-1}
            style={{ backgroundColor: "rgba(0,0,0,0.72)", zIndex: 1070 }}>
            <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
              <div className="modal-content card bg-body text-body border-secondary clear-theme-modal">
                <div className="modal-header border-secondary">
                  <div>
                    <h5 className="modal-title text-info fw-bold">Penalty Transaction History</h5>
                    <small className="text-muted">{active.studentName} · {active.penaltyId}</small>
                  </div>
                  <button type="button" className="btn-close" onClick={() => setHistoryPenaltyId(null)} aria-label="Close" />
                </div>
                <div className="modal-body">
                  <p className="small text-muted">Type: <strong>{active.penaltyType === "LATE_FEE" ? "Late Fee (Cash Only)" : "Community-Service Eligible"}</strong>
                    {" · "}Original assessment: <strong>{fmt(active.assessedAmount ?? active.hoursLate * active.ratePerHour)}</strong>
                    {" · "}Outstanding: <strong>{fmt(active.fineAmount)}</strong>
                  </p>
                  <div className="table-responsive">
                    <table className="table table-sm table-hover text-body align-middle">
                      <thead><tr><th>Transaction Date</th><th>Method / Action</th><th>Period</th><th>OR Number</th><th className="text-end">Amount</th><th>Processed By / Note</th></tr></thead>
                      <tbody>
                        {rows.map(row => <tr key={row.id}>
                          <td>{formatManilaDateTime24(row.date)}</td>
                          <td>
                            <strong>{({ ASSESSMENT: "Assessment", CASH_PAYMENT: "Cash payment", COMMUNITY_SERVICE: "Community service", CASH_REVERSAL: "Payment void / reversal", LEGACY_CASH: "Historical cash receipt", LEGACY_VOID_RECEIPT: "Voided historical receipt", LEGACY_SERVICE: "Historical service credit" } as Record<string, string>)[row.method] || row.method}</strong>
                            {row.minutesRendered > 0 && <div className="small text-muted">{row.minutesRendered} minutes rendered</div>}
                          </td>
                          <td className="small">{row.accountingPeriod}</td>
                          <td className="font-monospace">{row.orNumber || "—"}</td>
                          <td className={`text-end fw-semibold ${row.amount < 0 ? "text-danger" : ""}`}>{row.amount < 0 ? "−" : ""}{fmt(Math.abs(row.amount))}</td>
                          <td><div>{row.recordedBy}</div><small className="text-muted">{row.note}</small></td>
                        </tr>)}
                        {!rows.length && <tr><td colSpan={6} className="text-muted text-center">No events recorded</td></tr>}
                      </tbody>
                    </table>
                  </div>
                  <p className="small text-muted mb-0">Community-service credits are noncash. Negative values are receipt reversals, not refunds. Legacy events are labeled separately when their structured history was unavailable.</p>
                </div>
                <div className="modal-footer border-secondary bg-body-secondary">
                  <button type="button" className="btn btn-secondary" onClick={() => setHistoryPenaltyId(null)}>Close</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* =====================================================
          COMMUNITY SERVICE MODAL
      ====================================================== */}
      {selectedPenalty && (
        <div className="modal fade show d-block" tabIndex={-1} style={{ backgroundColor: "rgba(0,0,0,0.75)", zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content card border-secondary bg-body text-body shadow-lg clear-theme-modal">

              <div className="modal-header border-secondary">
                <h5 className="modal-title text-info fw-bold">
                  <i className="bi bi-person-workspace me-2"></i>Log Community Service
                </h5>
                <button type="button" className="btn-close" onClick={() => setSelectedPenalty(null)}></button>
              </div>

              <form onSubmit={handleCommunityServiceSubmit}>
                <div className="modal-body">
                  <div className="mb-2">
                    <label className="form-label text-muted small fw-semibold">Student Name</label>
                    <input type="text" className="form-control text-body bg-body-secondary border-secondary" value={selectedPenalty.studentName} readOnly />
                  </div>

                  <div className="mb-3">
                    <label className="form-label text-muted small fw-semibold">Original Duration / Current Outstanding Fine</label>
                    <div className="d-flex justify-content-between align-items-center p-2 rounded border border-secondary bg-body-secondary">
                      <span className="fw-bold text-warning">{formatHoursAndMinutes(selectedPenalty.hoursLate)}</span>
                      <span className="fw-bold text-danger">{fmt(selectedPenalty.fineAmount)}</span>
                    </div>
                  </div>

                  <p className="text-muted small mb-2">
                    Rate: <strong>₱{selectedPenalty.ratePerHour} / hr</strong>.
                    Maximum service equivalent for current balance: <strong>{maxServiceMinutes} minute(s)</strong>.
                  </p>

                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label text-muted small fw-semibold">Hours Rendered</label>
                      <input type="number" min="0" className="form-control bg-body text-body border-secondary" value={csHours} onChange={(e) => setCsHours(parseFloat(e.target.value) || 0)} required />
                    </div>
                    <div className="col-6">
                      <label className="form-label text-muted small fw-semibold">Minutes Rendered</label>
                      <input type="number" min="0" max="59" className="form-control bg-body text-body border-secondary" value={csMinutes} onChange={(e) => setCsMinutes(parseFloat(e.target.value) || 0)} required />
                    </div>
                  </div>

                  <div className="alert alert-info py-2 small mb-0 border-info">
                    <div className="d-flex justify-content-between mb-1">
                      <span>Equivalent Deduction:</span>
                      <strong className="text-success">{fmt(csDeduction)}</strong>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span>Remaining Penalty Balance:</span>
                      <strong className="text-warning">{formatHoursAndMinutes(csRemainingHours)} ({fmt(csRemainingFine)})</strong>
                    </div>
                  </div>
                </div>

                <div className="modal-footer border-secondary bg-body-secondary">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelectedPenalty(null)}>Cancel</button>
                    <button type="submit" className="btn btn-info btn-sm fw-bold text-dark" disabled={isSubmittingCs || periodClosed || Math.round(csRenderedHours * 60) > maxServiceMinutes}>
                    {isSubmittingCs ? "Applying..." : "Apply Community Service"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}