"use client";

import { useState } from "react";
import { fmt, formatHoursAndMinutes } from "@/lib/utils";
import { format } from "date-fns";
import { recordPenalty, settlePenaltyCommunityService, deletePenalty } from "../actions";
import Link from "next/link";
import { ThemedAlert } from '@/lib/alerts';

interface Student { studentId: string; fullName: string; email: string | null; }
interface Penalty { id: string; penaltyId: string; date: Date; studentId: string | null; studentName: string; activity: string; hoursLate: number; ratePerHour: number; fineAmount: number; status: string; }

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
  const todayStr = new Date().toISOString().split('T')[0];

  // Form State
  const [date, setDate] = useState(todayStr);
  const [searchQuery, setSearchQuery] = useState("");
  const [studentId, setStudentId] = useState("");
  const [studentName, setStudentName] = useState("");
  const [activity, setActivity] = useState("");
  const [hours, setHours] = useState<number>(0);
  const [minutes, setMinutes] = useState<number>(0);
  const [ratePerHour, setRatePerHour] = useState<number>(50.00);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const totalPages = Math.ceil(penalties.length / pageSize) || 1;
  const paginatedPenalties = penalties.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Community Service Modal State
  const [selectedPenalty, setSelectedPenalty] = useState<Penalty | null>(null);
  const [csHours, setCsHours] = useState<number>(0);
  const [csMinutes, setCsMinutes] = useState<number>(0);
  const [isSubmittingCs, setIsSubmittingCs] = useState(false);

  const baseUrl = `http://${department}.localhost:3000`;

  // Dynamic Fine Calculation
  const totalHours = hours + (minutes / 60);
  const totalFine = Math.round(totalHours * ratePerHour * 100) / 100;

  // Community Service Deductions Calculation
  const csRenderedHours = csHours + (csMinutes / 60);
  const activeRate = selectedPenalty ? (selectedPenalty.ratePerHour || 50.00) : ratePerHour;
  const csDeduction = selectedPenalty ? Math.min(selectedPenalty.fineAmount, Math.round(csRenderedHours * activeRate * 100) / 100) : 0;
  const csRemainingFine = selectedPenalty ? Math.max(0, Math.round((selectedPenalty.fineAmount - csDeduction) * 100) / 100) : 0;
  const csRemainingHours = selectedPenalty ? Math.max(0, Math.round((selectedPenalty.hoursLate - csRenderedHours) * 10000) / 10000) : 0;

  // Auto-fill student
  const handleStudentSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    const match = students.find(s => 
      `${s.fullName} (${s.studentId})`.toLowerCase() === val.toLowerCase() ||
      s.studentId.toLowerCase() === val.toLowerCase() ||
      s.fullName.toLowerCase() === val.toLowerCase()
    );
    if (match) {
      setStudentId(match.studentId);
      setStudentName(match.fullName);
    }
  };
  
  const handleDeletePenalty = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete/void the penalty record for ${name}?`)) return;

    try {
      await deletePenalty(department, id);
      alert("Penalty record removed successfully.");
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

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
      setCurrentPage(1); // Reset to first page on new entry
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
    if (!selectedPenalty || csRenderedHours <= 0) return alert("Please enter valid service hours rendered.");

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
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsSubmittingCs(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmitPenalty} className="mb-4 card p-3 border-secondary bg-card shadow-sm">
        <h6 className="text-accent fw-bold mb-3"><i className="bi bi-plus-circle me-2"></i>Log New Penalty Infraction</h6>
        <div className="row g-2 mb-2">
          <div className="col-md-6">
            <label className="form-label text-secondary small fw-semibold">Date of Activity</label>
            <input type="date" className="form-control bg-card text-color border-secondary" value={date} onChange={e => setDate(e.target.value)} required />
          </div>
          <div className="col-md-6">
            <label className="form-label text-secondary small fw-semibold">Search Student</label>
            <input 
              list="penaltyStudentList" 
              className="form-control bg-card text-color border-secondary" 
              placeholder="Search student name or ID..."
              value={searchQuery}
              onChange={handleStudentSearch}
              required 
            />
            <datalist id="penaltyStudentList">
              {students.map(s => <option key={s.studentId} value={`${s.fullName} (${s.studentId})`} />)}
            </datalist>
          </div>
        </div>

        <div className="row g-2 mb-2">
          <div className="col-md-4">
            <label className="form-label text-secondary small fw-semibold">Student ID</label>
            <input type="text" className="form-control bg-card text-secondary font-monospace border-secondary" value={studentId} readOnly />
          </div>
          <div className="col-md-8">
            <label className="form-label text-secondary small fw-semibold">Full Name</label>
            <input type="text" className="form-control bg-card text-secondary border-secondary" value={studentName} readOnly required />
          </div>
        </div>

        <div className="row g-2 mb-3">
          <div className="col-md-4">
            <label className="form-label text-secondary small fw-semibold">Activity / Reason</label>
            <input type="text" className="form-control bg-card text-color border-secondary" placeholder="e.g. General Assembly" value={activity} onChange={e => setActivity(e.target.value)} required />
          </div>
          <div className="col-md-3">
            <label className="form-label text-secondary small fw-semibold">Hours Late</label>
            <input type="number" min="0" className="form-control bg-card text-color border-secondary" value={hours} onChange={e => setHours(parseFloat(e.target.value) || 0)} required />
          </div>
          <div className="col-md-3">
            <label className="form-label text-secondary small fw-semibold">Minutes Late</label>
            <input type="number" min="0" max="59" className="form-control bg-card text-color border-secondary" value={minutes} onChange={e => setMinutes(parseFloat(e.target.value) || 0)} required />
          </div>
          <div className="col-md-2">
            <label className="form-label text-secondary small fw-semibold">Rate / hr (₱)</label>
            <input type="number" step="0.01" min="0" className="form-control bg-card text-color border-secondary" value={ratePerHour} onChange={e => setRatePerHour(parseFloat(e.target.value) || 0)} required />
          </div>
        </div>

        <div className="alert alert-warning py-2 mb-3 d-flex justify-content-between align-items-center border-warning">
          <span className="small fw-bold">COMPUTED PENALTY FINE ({formatHoursAndMinutes(totalHours)} @ ₱{ratePerHour}/hr):</span>
          <span className="fs-5 fw-bold text-danger">{fmt(totalFine)}</span>
        </div>

        <button type="submit" className="btn btn-danger fw-bold w-100" disabled={isSubmitting}>
          {isSubmitting ? "Logging..." : "Log Official Penalty"}
        </button>
      </form>

      <div className="d-flex justify-content-between align-items-center mb-2">
        <h6 className="fw-bold text-secondary m-0">Logged Penalties for this Term ({penalties.length})</h6>
        <span className="text-secondary small">Showing page {currentPage} of {totalPages}</span>
      </div>

      <div className="table-responsive">
        <table className="table table-sm table-hover align-middle text-white w-100" style={{ fontSize: '0.85rem' }}>
          <thead>
            <tr className="text-secondary border-bottom border-secondary">
              <th className="py-2" style={{ width: '10%' }}>Date</th>
              <th className="py-2" style={{ width: '25%' }}>Student</th>
              <th className="py-2" style={{ width: '20%' }}>Activity</th>
              <th className="py-2" style={{ width: '10%' }}>Duration</th>
              <th className="py-2" style={{ width: '8%' }}>Rate</th>
              <th className="py-2 text-end" style={{ width: '10%' }}>Fine</th>
              <th className="py-2" style={{ width: '9%' }}>Status</th>
              <th className="py-2 text-center" style={{ width: '8%' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {paginatedPenalties.length === 0 ? (
              <tr><td colSpan={8} className="text-center text-secondary py-4">No penalty records found for this term.</td></tr>
            ) : (
              paginatedPenalties.map(p => {
                const isUnsettled = !p.status.includes('Settled') && !p.status.includes('Voided');
                return (
                  <tr key={p.id} className="border-bottom border-secondary">
                    <td className="text-secondary py-2">{format(new Date(p.date), 'yyyy-MM-dd')}</td>
                    <td className="py-2">
                      <strong className="d-block text-truncate" style={{ maxWidth: '200px' }} title={p.studentName}>{p.studentName}</strong>
                      <span className="text-secondary font-monospace" style={{ fontSize: '0.75rem' }}>{p.studentId || 'N/A'}</span>
                    </td>
                    <td className="py-2 text-truncate" style={{ maxWidth: '150px' }} title={p.activity}>{p.activity}</td>
                    <td className="py-2"><span className="badge border border-secondary text-info px-1 py-0">{formatHoursAndMinutes(p.hoursLate)}</span></td>
                    <td className="py-2 text-secondary">₱{p.ratePerHour || 50.00}</td>
                    <td className="py-2 text-end text-danger fw-bold">{fmt(p.fineAmount)}</td>
                    <td className="py-2">
                      <span className={`badge px-1 py-1 ${p.status.includes('Settled') ? 'bg-success' : 'bg-danger'}`} style={{ fontSize: '0.7rem' }}>
                        {p.status}
                      </span>
                    </td>
<td className="py-2 text-center" style={{ minWidth: '100px' }}>
  <div className="d-flex flex-column gap-1 w-100">
    {isUnsettled && (
      <>
        <Link 
          href={`${baseUrl}/collections?ay=${ay}&term=${term}&prefillId=${p.studentId}`} 
          className="btn btn-outline-info btn-xs py-0 w-100 text-center" 
          style={{ fontSize: '0.75rem' }}
        >
          Pay in Cash
        </Link>
        <button 
          className="btn btn-outline-warning btn-xs py-0 w-100 text-center" 
          style={{ fontSize: '0.75rem' }} 
          onClick={() => openCsModal(p)}
        >
          Community Service
        </button>
      </>
    )}
    <button 
      className="btn btn-outline-danger btn-xs py-0 w-100 text-center" 
      style={{ fontSize: '0.75rem' }} 
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

      {/* PAGINATION CONTROLS */}
      {totalPages > 1 && (
        <div className="d-flex justify-content-between align-items-center mt-3 pt-2 border-top border-secondary">
          <button 
            className="btn btn-outline-secondary btn-sm px-3" 
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
          >
            <i className="bi bi-chevron-left me-1"></i> Previous
          </button>
          
          <div className="d-flex gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(num => (
              <button
                key={num}
                className={`btn btn-sm px-2 py-1 ${currentPage === num ? 'btn-info fw-bold text-dark' : 'btn-outline-secondary text-white'}`}
                onClick={() => setCurrentPage(num)}
              >
                {num}
              </button>
            ))}
          </div>

          <button 
            className="btn btn-outline-secondary btn-sm px-3" 
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
          >
            Next <i className="bi bi-chevron-right ms-1"></i>
          </button>
        </div>
      )}

      {/* COMMUNITY SERVICE MODAL */}
      {selectedPenalty && (
        <div className="modal fade show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content card border-secondary bg-dark text-white">
              <div className="modal-header border-secondary">
                <h5 className="modal-title text-accent"><i className="bi bi-person-workspace me-2"></i>Log Community Service</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setSelectedPenalty(null)}></button>
              </div>
              <form onSubmit={handleCommunityServiceSubmit}>
                <div className="modal-body">
                  <div className="mb-2">
                    <label className="form-label text-secondary small fw-semibold">Student Name</label>
                    <input type="text" className="form-control text-secondary bg-card border-secondary" value={selectedPenalty.studentName} readOnly />
                  </div>

                  <div className="mb-3">
                    <label className="form-label text-secondary small fw-semibold">Penalty Infraction Obligation</label>
                    <div className="d-flex justify-content-between align-items-center p-2 rounded border border-secondary bg-card">
                      <span className="fw-bold text-warning">{formatHoursAndMinutes(selectedPenalty.hoursLate)}</span>
                      <span className="fw-bold text-danger">{fmt(selectedPenalty.fineAmount)}</span>
                    </div>
                  </div>

                  <p className="text-secondary small mb-2">Rate: <strong>₱{selectedPenalty.ratePerHour || 50.00} / hr</strong>.</p>

                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label text-secondary small fw-semibold">Hours Rendered</label>
                      <input type="number" min="0" className="form-control bg-card text-color border-secondary" value={csHours} onChange={e => setCsHours(parseFloat(e.target.value) || 0)} required />
                    </div>
                    <div className="col-6">
                      <label className="form-label text-secondary small fw-semibold">Minutes Rendered</label>
                      <input type="number" min="0" max="59" className="form-control bg-card text-color border-secondary" value={csMinutes} onChange={e => setCsMinutes(parseFloat(e.target.value) || 0)} required />
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
                <div className="modal-footer border-secondary">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelectedPenalty(null)}>Cancel</button>
                  <button type="submit" className="btn btn-info btn-sm fw-bold" disabled={isSubmittingCs}>
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