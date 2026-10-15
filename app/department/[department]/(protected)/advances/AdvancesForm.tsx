// /app/department/[department]/(protected)/advances/AdvancesForm.tsx

"use client";

import { useState, useMemo } from "react";
import { fmt } from "@/lib/utils";
import { issueCashAdvance } from "./actions";
import { ThemedAlert } from '@/lib/alerts';

interface Student { studentId: string; fullName: string; }
interface Fund { name: string; balance: number; }

export default function AdvancesForm({
  department,
  ay,
  term,
  students,
  funds
}: {
  department: string;
  ay: string;
  term: string;
  students: Student[];
  funds: Fund[];
}) {
  const todayStr = new Date().toISOString().split('T')[0];

  const [dateIssued, setDateIssued] = useState(todayStr);
  const [expectedReturnDate, setExpectedReturnDate] = useState(todayStr);
  const [searchQuery, setSearchQuery] = useState("");
  const [studentId, setStudentId] = useState("");
  const [requestor, setRequestor] = useState("");
  const [purpose, setPurpose] = useState("");
  const [fundSource, setFundSource] = useState(funds[0]?.name || "General Fund (Carried Over)");
  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dynamic Fund Balance Display[cite: 31]
  const selectedFundBalance = useMemo(() => {
    const found = funds.find(f => f.name === fundSource);
    return found ? found.balance : 0;
  }, [fundSource, funds]);

  // Handle Datalist Selection (Replaces debouncedStudentSelect)[cite: 31]
  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);

    const match = students.find(s => 
      `${s.fullName} (${s.studentId})`.toLowerCase() === val.toLowerCase() ||
      s.studentId.toLowerCase() === val.toLowerCase() ||
      s.fullName.toLowerCase() === val.toLowerCase()
    );

    if (match) {
      setStudentId(match.studentId);
      setRequestor(match.fullName);
    }
  };

  // Submit Handler (Replaces caFormEl.onsubmit)[cite: 31]
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount) || 0;

    if (amt <= 0) return alert("Please enter a valid cash advance amount greater than ₱0.00.");
    if (expectedReturnDate < dateIssued) return alert("Validation Error: Expected return date cannot be earlier than the date of issuance.");

    setIsSubmitting(true);

    const formattedRequestor = (studentId && !requestor.includes(studentId)) 
      ? `${requestor} (${studentId})` 
      : requestor;

    try {
      await issueCashAdvance(department, {
        requestor: formattedRequestor,
        purpose,
        fundSource,
        amount: amt,
        dateIssued,
        expectedReturnDate,
        ay,
        term
      });

      alert("Cash Advance issued successfully!");
      
      // Reset form
      setSearchQuery("");
      setStudentId("");
      setRequestor("");
      setPurpose("");
      setAmount("");
      setDateIssued(todayStr);
      setExpectedReturnDate(todayStr);
      
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="row g-2 mb-2">
        <div className="col-md-6">
          <label className="form-label text-secondary small fw-semibold">Date Issued</label>
          <input type="date" className="form-control" value={dateIssued} onChange={e => setDateIssued(e.target.value)} required />
        </div>
        <div className="col-md-6">
          <label className="form-label text-secondary small fw-semibold">Search Requestor</label>
          <input 
            list="caStudentList" 
            className="form-control" 
            placeholder="Type name or ID to auto-fill..."
            value={searchQuery}
            onChange={handleSearchInput}
          />
          <datalist id="caStudentList">
            {students.map(s => <option key={s.studentId} value={`${s.fullName} (${s.studentId})`} />)}
          </datalist>
        </div>
      </div>

      <div className="row g-2 mb-2">
        <div className="col-md-4">
          <label className="form-label text-secondary small fw-semibold">ID</label>
          <input type="text" className="form-control text-secondary" value={studentId} readOnly />
        </div>
        <div className="col-md-8">
          <label className="form-label text-secondary small fw-semibold">Requestor Name</label>
          <input type="text" className="form-control" value={requestor} onChange={e => setRequestor(e.target.value)} required />
        </div>
      </div>

      <div className="mb-2">
        <label className="form-label text-secondary small fw-semibold">Purpose / Activity</label>
        <input type="text" className="form-control" placeholder="e.g. Purchase of materials for JIECEP Week setup" value={purpose} onChange={e => setPurpose(e.target.value)} required />
      </div>

      <div className="row g-2 mb-3">
        <div className="col-md-4">
          <div className="d-flex justify-content-between align-items-center">
            <label className="form-label text-secondary small fw-semibold mb-0">Fund Source</label>
            <span className={`small fw-bold ${selectedFundBalance < 0 ? 'text-danger' : 'text-success'}`}>
              Bal: {fmt(selectedFundBalance)}
            </span>
          </div>
          <select className="form-select mt-1" value={fundSource} onChange={e => setFundSource(e.target.value)} required>
            {funds.map(f => (
              <option key={f.name} value={f.name}>{f.name} (Bal: {fmt(f.balance)})</option>
            ))}
          </select>
        </div>
        <div className="col-md-4">
          <label className="form-label text-secondary small fw-semibold">Approved Advance (₱)</label>
          <input type="number" step="0.01" className="form-control" value={amount} onChange={e => setAmount(e.target.value)} required />
        </div>
        <div className="col-md-4">
          <label className="form-label text-secondary small fw-semibold">Expected Return Date</label>
          <input type="date" className="form-control" value={expectedReturnDate} onChange={e => setExpectedReturnDate(e.target.value)} required />
        </div>
      </div>

      <button type="submit" className="btn btn-info fw-bold w-100" disabled={isSubmitting}>
        {isSubmitting ? "Issuing..." : "Issue Cash Advance"}
      </button>
    </form>
  );
}