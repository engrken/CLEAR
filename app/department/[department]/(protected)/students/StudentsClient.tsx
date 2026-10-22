// /app/department/[department]/(protected)/students/StudentsClient.tsx

"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { 
  toggleStudentStatus, 
  confirmAllEnrolled, 
  promoteSelectedYearLevels, 
  saveStudent, 
  deleteStudent, 
  bulkImportStudents 
} from "./actions";

import { ThemedAlert } from '@/lib/clear-dialogs';
import { confirmCommittedChange } from '@/lib/clear-dialogs';

interface StudentRecord {
  id: string;
  studentId: string;
  fullName: string;
  yearLevel: string | null;
  email: string | null;
  status: string;
}

export default function StudentsClient({
  department,
  organizationId,
  ay,
  term,
  initialStudents,
  totalDirectory,
  enrolledCount,
  notEnrolledCount,
  currentPage,
  totalPages,
  currentSearch,
  currentYear,
  currentStatus
}: {
  department: string;
  organizationId: string;
  ay: string;
  term: string;
  initialStudents: StudentRecord[];
  totalDirectory: number;
  enrolledCount: number;
  notEnrolledCount: number;
  currentPage: number;
  totalPages: number;
  currentSearch: string;
  currentYear: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(currentSearch);
  const [yearFilter, setYearFilter] = useState(currentYear);
  const [statusFilter, setStatusFilter] = useState(currentStatus);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Only selected internal IDs are stored (not student names or session cookies).
  // Session-scoped selection survives roster pagination/filter navigation.
  const selectionKey = `clear-promotion-selection:${department}`;
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionLoaded, setSelectionLoaded] = useState(false);
  useEffect(() => {
    setSelectionLoaded(false);
    try {
      const stored = JSON.parse(sessionStorage.getItem(selectionKey) || '[]');
      setSelectedIds(Array.isArray(stored)
        ? Array.from(new Set(stored.filter((id: unknown): id is string => typeof id === 'string' && id.length <= 100))).slice(0, 200)
        : []);
    } catch {
      setSelectedIds([]);
    }
    setSelectionLoaded(true);
  }, [selectionKey]);
  useEffect(() => {
    if (!selectionLoaded) return;
    try { sessionStorage.setItem(selectionKey, JSON.stringify(selectedIds)); } catch { /* storage unavailable */ }
  }, [selectionKey, selectedIds, selectionLoaded]);

  const canPromote = (level: string | null) => ['1st Year', '2nd Year', '3rd Year', '4th Year'].includes(level ?? '');
  const eligibleVisibleIds = initialStudents.filter(s => canPromote(s.yearLevel)).map(s => s.id);
  const visibleSelected = eligibleVisibleIds.length > 0 && eligibleVisibleIds.every(id => selectedIds.includes(id));
  const setStudentSelected = (id: string, checked: boolean) => {
    setSelectedIds(previous => {
      if (!checked) return previous.filter(x => x !== id);
      if (previous.includes(id)) return previous;
      if (previous.length >= 200) {
        void ThemedAlert.fire({ icon: 'warning', title: 'Selection Limit', text: 'Promote at most 200 students per batch.' });
        return previous;
      }
      return [...previous, id];
    });
  };
  const selectVisible = (checked: boolean) => {
    setSelectedIds(previous => {
      if (!checked) return previous.filter(id => !eligibleVisibleIds.includes(id));
      const next = Array.from(new Set([...previous, ...eligibleVisibleIds]));
      if (next.length > 200) {
        void ThemedAlert.fire({ icon: 'warning', title: 'Selection Limit', text: 'Promote at most 200 students per batch. Clear some selections first.' });
        return previous;
      }
      return next;
    });
  };

  const [showAddModal, setShowAddModal] = useState(false);
  const [editStudent, setEditStudent] = useState<StudentRecord | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [parsedRecords, setParsedRecords] = useState<any[]>([]);

  const updateQuery = (newParams: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(newParams).forEach(([key, val]) => {
      if (val && val !== 'ALL') params.set(key, val);
      else params.delete(key);
    });
    router.push(`${pathname}?${params.toString()}`);
  };

  const clearRosterSearchAfterSuccess = () => {
    setSearch("");
    updateQuery({ search: "", page: "1" });
    router.refresh();
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateQuery({ search, page: '1' });
  };

  const handlePageChange = (newPage: number) => {
    updateQuery({ page: String(newPage) });
  };

  const handleToggle = async (studentId: string, currentStatus: string) => {
    if (!await confirmCommittedChange({
      action: 'Confirm enrollment status change',
      target: `Student ${studentId} · ${ay} ${term}`,
      consequence: 'This changes current-term enrollment status and may affect mandatory-fee eligibility and clearance. Previous financial records remain intact.',
      confirmText: 'Change Enrollment Status',
    })) return;
    try {
      await toggleStudentStatus(department, studentId, currentStatus, ay, term);
      clearRosterSearchAfterSuccess();
    } catch (err: any) {
      await ThemedAlert.fire({ icon: 'error', title: 'Action Failed', text: "Error updating status: " + err.message });
    }
  };

  const handleConfirmAll = async () => {
    const res = await ThemedAlert.fire({
      icon: 'warning',
      title: 'Confirm All Enrolled?',
      text: `Confirm all students in directory as 'Enrolled' for ${term} (${ay})?`,
      showCancelButton: true,
      confirmButtonText: 'Yes, Confirm',
    });
    if (!res.isConfirmed) return;

    setIsSubmitting(true);
    try {
      await confirmAllEnrolled(department, organizationId, ay, term);
      clearRosterSearchAfterSuccess();
      await ThemedAlert.fire({ icon: 'success', title: 'Success', text: "All students successfully confirmed as enrolled." });
    } catch (err: any) {
      await ThemedAlert.fire({ icon: 'error', title: 'Error', text: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePromote = async () => {
    if (!selectedIds.length || isSubmitting) return;
    const res = await ThemedAlert.fire({
      icon: 'warning',
      title: 'Promote Selected Students?',
      text: `Advance exactly ${selectedIds.length} selected student(s) by one year level? Only the selected records will be changed. Graduating 4th Year students become Graduated / Alumni.`,
      showCancelButton: true,
      confirmButtonText: `Promote ${selectedIds.length} Selected`,
      cancelButtonText: 'Cancel',
    });
    if (!res.isConfirmed) return;

    setIsSubmitting(true);
    try {
      const promotionRes = await promoteSelectedYearLevels(department, organizationId, selectedIds);
      setSelectedIds([]);
      try { sessionStorage.removeItem(selectionKey); } catch { /* storage unavailable */ }
      clearRosterSearchAfterSuccess();
      await ThemedAlert.fire({ icon: 'success', title: 'Promotion Complete', text: `Successfully advanced ${promotionRes.promoted} selected student(s).` });
    } catch (err: any) {
      await ThemedAlert.fire({ icon: 'error', title: 'Promotion Failed', text: err?.message || 'Unable to promote selected students.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (studentInternalId: string, name: string) => {
    if (isSubmitting) return;
    const res = await ThemedAlert.fire({
      icon: 'warning',
      title: 'Delete Student?',
      text: `Permanently remove student "${name}"? Students with financial records cannot be deleted; use Set Inactive instead.`,
      showCancelButton: true,
      confirmButtonText: 'Yes, Delete',
      confirmButtonColor: '#dc3545',
    });
    if (!res.isConfirmed) return;

    setIsSubmitting(true);
    try {
      const outcome = await deleteStudent(department, studentInternalId);
      if (!outcome.success) {
        await ThemedAlert.fire({
          icon: 'warning',
          title: outcome.code === 'FINANCIAL_HISTORY' ? 'Deletion Not Allowed' : 'Student Not Found',
          text: outcome.message,
        });
        return;
      }
      setSelectedIds(previous => previous.filter(id => id !== studentInternalId));
      clearRosterSearchAfterSuccess();
      await ThemedAlert.fire({ icon: 'success', title: 'Deleted', text: 'Student record successfully deleted.' });
    } catch (err) {
      console.error('Student deletion failed:', err);
      await ThemedAlert.fire({
        icon: 'error', title: 'Delete Failed',
        text: 'Could not delete the student. Check the server logs for details, or use Set Inactive if financial history exists.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveStudentSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    const payload = {
      id: editStudent ? editStudent.id : undefined,
      studentId: formData.get("studentId") as string,
      fullName: formData.get("fullName") as string,
      yearLevel: formData.get("yearLevel") as string,
      email: formData.get("email") as string,
      enrollmentStatus: formData.get("enrollmentStatus") as string,
      isEdit: !!editStudent,
    };

    if (!await confirmCommittedChange({
      action: editStudent ? 'Confirm student roster update' : 'Confirm new student',
      target: `${payload.fullName} · ${payload.studentId} · ${ay} ${term}`,
      consequence: 'This updates the authorized tenant roster and enrollment details. Check the Student ID and email before saving.',
      confirmText: editStudent ? 'Update Student' : 'Add Student',
    })) return;
    setIsSubmitting(true);
    try {
      await saveStudent(department, organizationId, ay, term, payload);
      clearRosterSearchAfterSuccess();
      setShowAddModal(false);
      setEditStudent(null);
      await ThemedAlert.fire({ icon: 'success', title: 'Saved', text: 'Student record successfully saved.' });
    } catch (err: any) {
      await ThemedAlert.fire({ icon: 'error', title: 'Error', text: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleParseCSV = (text: string) => {
    setCsvText(text);
    const lines = text.split(/\r\n|\n/);
    const records: any[] = [];
    let startIdx = 0;
    if (lines.length > 0 && lines[0].toLowerCase().includes("id")) startIdx = 1;
    
    for (let i = startIdx; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      // 🚀 FIX: Corrected CSV regex cleaning
      const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.trim().replace(/^"|"$/g, "").replace(/""/g, "\"").replace(/^'|'$/g, ""));
      if (cols.length >= 2) {
        records.push({ studentId: cols[0], fullName: cols[1], yearLevel: cols[2] || "1st Year", email: cols[3] || "" });
      }
    }
    setParsedRecords(records);
  };

  const handleExecuteImport = async () => {
    if (!parsedRecords.length) return;
    const res = await ThemedAlert.fire({
      icon: 'question',
      title: 'Import Students?',
      text: `Import ${parsedRecords.length} student records into the directory?`,
      showCancelButton: true,
      confirmButtonText: 'Import',
    });
    if (!res.isConfirmed) return;

    setIsSubmitting(true);
    try {
      const importRes = await bulkImportStudents(department, organizationId, ay, term, parsedRecords);
      clearRosterSearchAfterSuccess();
      await ThemedAlert.fire({ icon: 'success', title: 'Import Successful', text: importRes.message });
      setShowImportModal(false);
      setParsedRecords([]);
      setCsvText("");
    } catch (err: any) {
      await ThemedAlert.fire({ icon: 'error', title: 'Import Failed', text: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto" style={{ maxWidth: '1250px', minWidth: 0 }}>
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
        <div>
          <h4 className="text-primary fw-bold m-0 d-flex align-items-center gap-2">
            <i className="bi bi-people-fill"></i> List of Students Enrolled
          </h4>
          <span className="text-info small fw-semibold">({ay} | {term})</span>
        </div>
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <button className="btn btn-outline-secondary btn-sm px-3 shadow-sm" onClick={() => window.location.reload()}>
            <i className="bi bi-arrow-clockwise me-1"></i>Refresh
          </button>
          <button className="btn btn-outline-success btn-sm px-3 shadow-sm" onClick={handleConfirmAll} disabled={isSubmitting}>
            <i className="bi bi-check2-all me-1 text-success"></i>Confirm All Enrolled
          </button>
          <button className="btn btn-outline-warning btn-sm px-3 shadow-sm" onClick={() => setShowImportModal(true)}>
            <i className="bi bi-file-earmark-spreadsheet me-1"></i>Bulk Import CSV
          </button>
          <button type="button" className="btn btn-outline-secondary btn-sm px-3 shadow-sm" onClick={handlePromote} disabled={isSubmitting || !selectionLoaded || selectedIds.length === 0} title="Only checked students will be promoted">
            <i className="bi bi-arrow-up-circle me-1"></i>Promote Selected ({selectedIds.length})
          </button>
          <button type="button" className="btn btn-info btn-sm fw-bold px-3 shadow-sm" onClick={() => { setEditStudent(null); setShowAddModal(true); }}>
            <i className="bi bi-person-plus-fill me-1"></i>Add Student
          </button>
        </div>
      </div>
      <p className="text-muted small fst-italic mb-3">Starting {ay} ({term}), only confirmed enrolled students are available in search lists.</p>

      <div className="row g-3 mb-4">
        <div className="col-6 col-md-3">
          <div className="card border-secondary p-3 shadow-sm">
            <div className="text-muted small fw-semibold" style={{ fontSize: '0.7rem' }}>TOTAL DIRECTORY</div>
            <h3 className="fw-bold mt-1 mb-0">{totalDirectory}</h3>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card border-secondary p-3 shadow-sm">
            <div className="text-muted small fw-semibold" style={{ fontSize: '0.7rem' }}>ENROLLED (SEARCHABLE)</div>
            <h3 className="text-success fw-bold mt-1 mb-0">{enrolledCount}</h3>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card border-secondary p-3 shadow-sm">
            <div className="text-muted small fw-semibold" style={{ fontSize: '0.7rem' }}>NOT ENROLLED (HIDDEN)</div>
            <h3 className="text-warning fw-bold mt-1 mb-0">{notEnrolledCount}</h3>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card border-secondary p-3 shadow-sm">
            <div className="text-muted small fw-semibold" style={{ fontSize: '0.7rem' }}>PAGE RESULTS</div>
            <h3 className="text-info fw-bold mt-1 mb-0">{initialStudents.length}</h3>
          </div>
        </div>
      </div>

      <div className="card border-secondary shadow-sm p-3 mb-4">
        <form onSubmit={handleSearchSubmit} className="row g-3 align-items-center">
          <div className="col-12 col-md-5">
            <div className="input-group input-group-sm">
              <span className="input-group-text border-secondary text-muted"><i className="bi bi-search"></i></span>
              <input 
                type="text" 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
                placeholder="Search by ID, Name, or Email..." 
                className="form-control form-control-sm border-secondary" 
              />
            </div>
          </div>
          <div className="col-12 col-md-3">
            <select 
              value={yearFilter} 
              onChange={e => { setYearFilter(e.target.value); updateQuery({ year: e.target.value, page: '1' }); }} 
              className="form-select form-select-sm border-secondary"
            >
              <option value="ALL">All Year Levels</option>
              <option value="1st Year">1st Year</option>
              <option value="2nd Year">2nd Year</option>
              <option value="3rd Year">3rd Year</option>
              <option value="4th Year">4th Year</option>
              <option value="Graduated / Alumni">Graduated / Alumni</option>
              <option value="Unassigned">Unassigned</option>
            </select>
          </div>
          <div className="col-12 col-md-3">
            <select 
              value={statusFilter} 
              onChange={e => { setStatusFilter(e.target.value); updateQuery({ status: e.target.value, page: '1' }); }} 
              className="form-select form-select-sm border-secondary"
            >
              <option value="ALL">All Enrollment Statuses</option>
              <option value="Enrolled">Confirmed Enrolled Only</option>
              <option value="Inactive">Not Enrolled Only</option>
            </select>
          </div>
          <div className="col-12 col-md-1">
            <button type="submit" className="btn btn-info btn-sm w-100 fw-bold">Filter</button>
          </div>
        </form>
      </div>

      <div className="card border-secondary shadow-sm p-3 mb-3">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <span className="small text-info fw-semibold" role="status">
            <i className="bi bi-check2-square me-1"></i>{selectedIds.length} student(s) selected for promotion across roster pages
          </span>
          <button type="button" className="btn btn-sm btn-outline-secondary" disabled={isSubmitting || selectedIds.length === 0} onClick={() => setSelectedIds([])}>
            Clear Selection
          </button>
        </div>
        <div className="table-responsive">
          <table className="table table-hover align-middle small mb-0">
            <thead>
              <tr className="text-muted border-bottom border-secondary">
                <th className="py-2" style={{ width: '40px' }}>
                  <input type="checkbox" className="form-check-input" aria-label="Select all eligible students on this page" title="Select eligible students on this page only" checked={visibleSelected} disabled={isSubmitting || eligibleVisibleIds.length === 0} onChange={e => selectVisible(e.target.checked)} />
                </th>
                <th className="py-2">Student ID</th>
                <th className="py-2">Full Name</th>
                <th className="py-2">Year Level</th>
                <th className="py-2">Notification Email</th>
                <th className="py-2">Status (Current Term)</th>
                <th className="text-end py-2" style={{ width: '140px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {initialStudents.length === 0 ? (
                <tr><td colSpan={7} className="text-center text-muted py-4">No student records found matching search criteria.</td></tr>
              ) : (
                initialStudents.map((student) => {
                  const isEnrolled = student.status === 'Enrolled';
                  return (
                    <tr key={student.id} className="border-bottom border-secondary border-opacity-25">
                      <td>
                        <input type="checkbox" className="form-check-input" aria-label={`Select ${student.fullName} for promotion`} checked={selectedIds.includes(student.id)} disabled={isSubmitting || !selectionLoaded || !canPromote(student.yearLevel)} onChange={e => setStudentSelected(student.id, e.target.checked)} />
                      </td>
                      <td className="fw-semibold font-monospace text-info">{student.studentId}</td>
                      <td className="fw-bold">{student.fullName}</td>
                      <td className="text-muted">{student.yearLevel || '—'}</td>
                      <td className="text-muted text-lowercase">{student.email || '—'}</td>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <span className={`badge px-2 py-1 ${isEnrolled ? 'bg-success bg-opacity-25 text-success border border-success' : 'bg-warning bg-opacity-25 text-warning border border-warning'}`}>
                            {isEnrolled ? '🟢 Enrolled' : `🟡 ${student.status}`}
                          </span>
                          <button 
                            type="button" 
                            className="btn btn-outline-warning btn-sm py-0 px-2" 
                            style={{ fontSize: '0.7rem' }}
                            onClick={() => handleToggle(student.id, student.status)}
                          >
                            {isEnrolled ? 'Set Inactive' : 'Set Enrolled'}
                          </button>
                        </div>
                      </td>
                      <td className="text-end">
                        <div className="d-flex justify-content-end gap-2">
                          <button 
                            type="button" 
                            className="btn btn-outline-info btn-sm p-1 px-2" 
                            title="Edit Student" 
                            onClick={() => { setEditStudent(student); setShowAddModal(true); }}
                          >
                            <i className="bi bi-pencil-square"></i>
                          </button>
                          <button 
                            type="button" 
                            className="btn btn-outline-danger btn-sm p-1 px-2" 
                            title="Delete Student"
                            onClick={() => handleDelete(student.id, student.fullName)}
                          >
                            <i className="bi bi-trash"></i>
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

        {totalPages > 1 && (
          <div className="d-flex justify-content-between align-items-center mt-3 pt-3 border-top border-secondary px-2">
            <small className="text-muted">
              Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
            </small>
            <ul className="pagination pagination-sm m-0">
              <li className={`page-item ${currentPage <= 1 ? 'disabled' : ''}`}>
                <button className="page-link border-secondary" onClick={() => handlePageChange(currentPage - 1)}>
                  Previous
                </button>
              </li>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(num => (
                <li key={num} className={`page-item ${currentPage === num ? 'active' : ''}`}>
                  <button 
                    className={`page-link border-secondary ${currentPage === num ? 'bg-info text-dark fw-bold border-info' : ''}`} 
                    onClick={() => handlePageChange(num)}
                  >
                    {num}
                  </button>
                </li>
              ))}
              <li className={`page-item ${currentPage >= totalPages ? 'disabled' : ''}`}>
                <button className="page-link border-secondary" onClick={() => handlePageChange(currentPage + 1)}>
                  Next
                </button>
              </li>
            </ul>
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="modal fade show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content card border-secondary shadow-lg p-3 clear-theme-modal">
              <div className="modal-header border-secondary">
                <h5 className="modal-title fw-bold">
                  <i className="bi bi-person-plus-fill me-2"></i>{editStudent ? "Modify Student Details" : "Add New Student Roster Record"}
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowAddModal(false)}></button>
              </div>
              <form onSubmit={handleSaveStudentSubmit}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label text-muted small fw-semibold">Student ID *</label>
                    <input type="text" name="studentId" defaultValue={editStudent?.studentId || ""} className="form-control border-secondary font-monospace" placeholder="24-CECE1-0001" required />
                  </div>
                  <div className="mb-3">
                    <label className="form-label text-muted small fw-semibold">Full Name * (SURNAME, FIRST NAME M.I.)</label>
                    <input type="text" name="fullName" defaultValue={editStudent?.fullName || ""} className="form-control border-secondary" placeholder="DELA CRUZ, JUAN A." required />
                  </div>
                  <div className="row g-2 mb-3">
                    <div className="col-md-6">
                      <label className="form-label text-muted small fw-semibold">Year Level</label>
                      <select name="yearLevel" defaultValue={editStudent?.yearLevel || "1st Year"} className="form-select border-secondary">
                        <option value="1st Year">1st Year</option>
                        <option value="2nd Year">2nd Year</option>
                        <option value="3rd Year">3rd Year</option>
                        <option value="4th Year">4th Year</option>
                        <option value="Graduated / Alumni">Graduated / Alumni</option>
                        <option value="Unassigned">Unassigned</option>
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label text-muted small fw-semibold">Enrollment (Current Term)</label>
                      <select name="enrollmentStatus" defaultValue={editStudent?.status || "Enrolled"} className="form-select border-secondary">
                        <option value="Enrolled">Confirmed Enrolled</option>
                        <option value="Inactive">Inactive / Not Enrolled</option>
                      </select>
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label text-muted small fw-semibold">Notification Email</label>
                    <input type="email" name="email" defaultValue={editStudent?.email || ""} className="form-control border-secondary" placeholder="student@domain.edu.ph" />
                  </div>
                </div>
                <div className="modal-footer border-secondary">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAddModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-info btn-sm fw-bold px-4" disabled={isSubmitting}>
                    {isSubmitting ? "Saving..." : "Save Student Record"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="modal fade show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content card border-secondary shadow-lg p-3 clear-theme-modal">
              <div className="modal-header border-secondary">
                <h5 className="modal-title fw-bold"><i className="bi bi-file-earmark-spreadsheet me-2"></i>Bulk Import Student Directory (CSV)</h5>
                <button type="button" className="btn-close" onClick={() => setShowImportModal(false)}></button>
              </div>
              <div className="modal-body">
                <p className="text-muted small mb-3">Upload a CSV file or paste CSV data. Expected columns: <code>Student ID, Full Name, Year Level, Email</code> (with header row).</p>
                <div className="mb-3">
                  <label className="form-label text-muted small fw-semibold">Select CSV File</label>
                  <input 
                    type="file" 
                    className="form-control border-secondary" 
                    accept=".csv" 
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = ev => handleParseCSV(ev.target?.result as string);
                        reader.readAsText(file);
                      }
                    }} 
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label text-muted small fw-semibold">Or Paste CSV Content Directly</label>
                  <textarea 
                    className="form-control border-secondary font-monospace" 
                    rows={5} 
                    placeholder="Student ID,Full Name,Year Level,Email&#10;24-CECE1-0001,SURNAME FIRSTNAME,1st Year,student@example.com" 
                    value={csvText}
                    onChange={e => handleParseCSV(e.target.value)}
                  ></textarea>
                </div>
                {parsedRecords.length > 0 && (
                  <div>
                    <label className="form-label text-muted small fw-semibold text-info">Parsed Preview ({parsedRecords.length} records ready)</label>
                    <div className="table-responsive border border-secondary rounded p-2" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                      <table className="table table-hover align-middle mb-0 small">
                        <thead>
                          <tr className="text-muted"><th>Student ID</th><th>Full Name</th><th>Year Level</th><th>Email</th></tr>
                        </thead>
                        <tbody>
                          {parsedRecords.slice(0, 10).map((r, idx) => (
                            <tr key={idx}>
                              <td>{r.studentId}</td>
                              <td>{r.fullName}</td>
                              <td>{r.yearLevel}</td>
                              <td>{r.email}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer border-secondary">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowImportModal(false)}>Cancel</button>
                <button type="button" className="btn btn-warning btn-sm fw-bold px-4" onClick={handleExecuteImport} disabled={isSubmitting || parsedRecords.length === 0}>
                  {isSubmitting ? "Importing..." : `Import ${parsedRecords.length} Students`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}