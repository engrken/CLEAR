"use client";

import { useState, useMemo } from "react";
import { fmt, formatHoursAndMinutes } from "@/lib/utils";
import { format } from "date-fns";
import {
  recordPenalty,
  settlePenaltyCommunityService,
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
}

export default function PenaltiesManager({
  department,
  ay,
  term,
  students,
  penalties
}: {
  department: string;
  ay: string;
  term: string;
  students: Student[];
  penalties: Penalty[];
}) {
  const router = useRouter();
  const todayStr = new Date().toISOString().split("T")[0];

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
      const matchesSearch = 
        p.studentName.toLowerCase().includes(logSearch.toLowerCase()) || 
        (p.studentId && p.studentId.toLowerCase().includes(logSearch.toLowerCase())) ||
        p.activity.toLowerCase().includes(logSearch.toLowerCase());

      const isUnsettled = !p.status.includes("Settled") && !p.status.includes("Voided");
      const isSettled = p.status.includes("Settled");
      const isVoided = p.status.includes("Voided");

      if (statusFilter === "Unsettled" && !isUnsettled) return false;
      if (statusFilter === "Settled" && !isSettled) return false;
      if (statusFilter === "Voided" && !isVoided) return false;

      return matchesSearch;
    });
  }, [penalties, logSearch, statusFilter]);

  const totalPages = Math.ceil(filteredPenalties.length / pageSize) || 1;

  const paginatedPenalties = filteredPenalties.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
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
  const totalFine = Math.round(totalHours * ratePerHour * 100) / 100;

  // =========================================================
  // COMMUNITY SERVICE CALCULATIONS
  // =========================================================
  const csRenderedHours = csHours + csMinutes / 60;
  const activeRate = selectedPenalty ? selectedPenalty.ratePerHour || 50.00 : ratePerHour;

  const csDeduction = selectedPenalty
    ? Math.min(selectedPenalty.fineAmount, Math.round(csRenderedHours * activeRate * 100) / 100)
    : 0;

  const csRemainingFine = selectedPenalty
    ? Math.max(0, Math.round((selectedPenalty.fineAmount - csDeduction) * 100) / 100)
    : 0;

  const csRemainingHours = selectedPenalty
    ? Math.max(0, Math.round((selectedPenalty.hoursLate - csRenderedHours) * 10000) / 10000)
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
    }
  };

  // =========================================================
  // DELETE / VOID PENALTY
  // =========================================================
  const handleDeletePenalty = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete/void the penalty record for ${name}?`)) {
      return;
    }

    try {
      await deletePenalty(department, id);
      alert("Penalty record removed successfully.");
      router.refresh(); 
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  // =========================================================
  // SUBMIT NEW PENALTY
  // =========================================================
  const handleSubmitPenalty = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!studentId || totalHours <= 0) {
      return alert("Please select a valid student and enter a valid lateness duration.");
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
        ay,
        term
      });

      alert(`Penalty of ${fmt(totalFine)} (${formatHoursAndMinutes(totalHours)} @ ₱${ratePerHour}/hr) logged for ${studentName}.`);

      setSearchQuery("");
      setStudentId("");
      setStudentName("");
      setActivity("");
      setHours(0);
      setMinutes(0);
      setCurrentPage(1);
      router.refresh();
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openCsModal = (p: Penalty) => {
    setSelectedPenalty(p);
    const totalMins = Math.round(p.hoursLate * 60);
    setCsHours(Math.floor(totalMins / 60));
    setCsMinutes(totalMins % 60);
  };

  const handleCommunityServiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPenalty || csRenderedHours <= 0) {
      return alert("Please enter valid service hours rendered.");
    }

    const isFullySettled = csRenderedHours >= selectedPenalty.hoursLate || csDeduction >= selectedPenalty.fineAmount;

    const confirmMsg = isFullySettled
      ? `Student rendered ${formatHoursAndMinutes(csRenderedHours)} (${fmt(csDeduction)} deduction).\n\nThis will FULLY SETTLE the penalty and clear the hold for ${selectedPenalty.studentName}.\n\nProceed?`
      : `Student rendered ${formatHoursAndMinutes(csRenderedHours)} (${fmt(csDeduction)} deduction).\n\nRemaining: ${formatHoursAndMinutes(csRemainingHours)} (${fmt(csRemainingFine)}).\n\nProceed?`;

    if (!confirm(confirmMsg)) return;

    setIsSubmittingCs(true);
    try {
      await settlePenaltyCommunityService(department, {
        penaltyId: selectedPenalty.penaltyId,
        hoursRendered: csRenderedHours,
        ay,
        term
      });

      alert("Community service credit successfully applied!");
      setSelectedPenalty(null);
      router.refresh();
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsSubmittingCs(false);
    }
  };

  const closeLogs = () => {
    setIsLogsOpen(false);
    setCurrentPage(1);
  };

  return (
    <>
      {/* =====================================================
          NEW PENALTY FORM
      ====================================================== */}
      <form onSubmit={handleSubmitPenalty} className="mb-4 card p-3 border-secondary bg-body shadow-sm text-body">
        <h6 className="text-info fw-bold mb-3">
          <i className="bi bi-plus-circle me-2"></i>Log New Penalty Infraction
        </h6>

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
          <div className="col-md-4">
            <label className="form-label text-muted small fw-semibold">Activity / Reason</label>
            <input type="text" className="form-control bg-body text-body border-secondary" placeholder="e.g. General Assembly" value={activity} onChange={(e) => setActivity(e.target.value)} required />
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

        <div className="alert border-warning bg-warning bg-opacity-10 text-warning py-2 mb-3 d-flex justify-content-between align-items-center shadow-sm">
          <span className="small fw-bold">COMPUTED PENALTY FINE ({formatHoursAndMinutes(totalHours)} @ ₱{ratePerHour}/hr):</span>
          <span className="fs-5 fw-bold text-danger">{fmt(totalFine)}</span>
        </div>

        <button type="submit" className="btn btn-danger fw-bold w-100 text-white" disabled={isSubmitting}>
          {isSubmitting ? "Logging..." : "Log Official Penalty"}
        </button>
      </form>

      {/* =====================================================
          PENALTY LOG BUTTON
      ====================================================== */}
      <div className="card border-secondary bg-body shadow-sm p-3 text-body">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2">
          <div>
            <h6 className="fw-bold text-info mb-1">Penalty Records</h6>
            <p className="text-muted small mb-0">
              {penalties.length === 0 ? "No penalty records have been logged for this term." : `${penalties.length} penalty record${penalties.length === 1 ? "" : "s"} logged for this term.`}
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
            <div className="modal-content card border-secondary bg-body text-body shadow-lg">

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
                        {penalties.filter(p => !p.status.includes("Settled") && !p.status.includes("Voided")).length}
                      </div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="border border-secondary rounded p-2 bg-body-secondary">
                      <div className="text-muted small">Total Fines Logged</div>
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
                      <option value="Voided">Voided Only</option>
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
                        <th className="py-2">Duration</th>
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
                          const isUnsettled = !p.status.includes("Settled") && !p.status.includes("Voided");
                          return (
                            <tr key={p.id} className="border-bottom border-secondary">
                              <td className="text-muted py-2">{format(new Date(p.date), "yyyy-MM-dd")}</td>
                              <td className="py-2">
                                <strong className="d-block text-truncate" style={{ maxWidth: "200px" }} title={p.studentName}>{p.studentName}</strong>
                                <span className="text-muted font-monospace" style={{ fontSize: "0.75rem" }}>{p.studentId || "N/A"}</span>
                              </td>
                              <td className="py-2 text-truncate" style={{ maxWidth: "180px" }} title={p.activity}>{p.activity}</td>
                              <td className="py-2"><span className="badge bg-body-secondary border border-secondary text-info px-1 py-0">{formatHoursAndMinutes(p.hoursLate)}</span></td>
                              <td className="py-2 text-muted">₱{p.ratePerHour || 50.00}</td>
                              <td className="py-2 text-end text-danger fw-bold">{fmt(p.fineAmount)}</td>
                              <td className="py-2">
                                <span className={`badge px-1 py-1 ${p.status.includes("Settled") ? "bg-success text-white" : p.status.includes("Voided") ? "bg-secondary text-white" : "bg-danger text-white"}`} style={{ fontSize: "0.7rem" }}>
                                  {p.status}
                                </span>
                              </td>
                              <td className="py-2 text-center" style={{ minWidth: "115px" }}>
                                <div className="d-flex flex-column gap-1 w-100">
                                  {isUnsettled && (
                                    <>
                                      <Link
  href={`/department/${encodeURIComponent(department)}/collections?ay=${encodeURIComponent(ay)}&term=${encodeURIComponent(term)}&prefillId=${encodeURIComponent(p.studentId || "")}&penaltyId=${encodeURIComponent(p.penaltyId)}&prefillCategory=Others&prefillDesc=${encodeURIComponent(`Penalty Fine: ${p.activity}`)}&prefillAmount=${p.fineAmount}`}
  className="btn btn-outline-info btn-xs py-0 w-100 text-center fw-semibold"
  style={{ fontSize: "0.75rem" }}
  onClick={() => setIsLogsOpen(false)}
>
  Pay in Cash
</Link>
                                      <button
                                        type="button"
                                        className="btn btn-outline-warning btn-xs py-0 w-100 text-center fw-semibold"
                                        style={{ fontSize: "0.75rem" }}
                                        onClick={() => openCsModal(p)}
                                      >
                                        Community Service
                                      </button>
                                    </>
                                  )}
                                  <button
                                    type="button"
                                    className="btn btn-outline-danger btn-xs py-0 w-100 text-center fw-semibold"
                                    style={{ fontSize: "0.75rem" }}
                                    onClick={() => handleDeletePenalty(p.id, p.studentName)}
                                    title="Delete / Void Penalty"
                                  >
                                    Void Penalty
                                  </button>
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
                      disabled={currentPage === 1}
                      title="First Page"
                    >
                      <i className="bi bi-chevron-double-left"></i> First
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm px-2"
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
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
                      disabled={currentPage === totalPages}
                    >
                      Next <i className="bi bi-chevron-right ms-1"></i>
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm px-2"
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
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
          COMMUNITY SERVICE MODAL
      ====================================================== */}
      {selectedPenalty && (
        <div className="modal fade show d-block" tabIndex={-1} style={{ backgroundColor: "rgba(0,0,0,0.75)", zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content card border-secondary bg-body text-body shadow-lg">

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
                    <label className="form-label text-muted small fw-semibold">Penalty Infraction Obligation</label>
                    <div className="d-flex justify-content-between align-items-center p-2 rounded border border-secondary bg-body-secondary">
                      <span className="fw-bold text-warning">{formatHoursAndMinutes(selectedPenalty.hoursLate)}</span>
                      <span className="fw-bold text-danger">{fmt(selectedPenalty.fineAmount)}</span>
                    </div>
                  </div>

                  <p className="text-muted small mb-2">
                    Rate: <strong>₱{selectedPenalty.ratePerHour || 50.00} / hr</strong>.
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
                  <button type="submit" className="btn btn-info btn-sm fw-bold text-dark" disabled={isSubmittingCs}>
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