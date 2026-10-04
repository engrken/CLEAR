"use client";

import { useState } from "react";
import { fmt } from "@/lib/utils";
import { submitOnlineRemittance } from "../actions";

interface StudentClearance {
  studentId: string;
  fullName: string;
  email: string | null;
  isCleared: boolean;
  unpaidItems: any[];
}

export default function ClearanceManager({
  department,
  ay,
  term,
  students
}: {
  department: string;
  ay: string;
  term: string;
  students: StudentClearance[];
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeStudent, setActiveStudent] = useState<StudentClearance | null>(null);

  // GCash / Maya Proof Modal State
  const [showProofModal, setShowProofModal] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [channel, setChannel] = useState("GCash");
  const [referenceNo, setReferenceNo] = useState("");
  const [collectionType, setCollectionType] = useState("Departmental Fee (Package)");
  const [paymentMode, setPaymentMode] = useState("Full Payment");
  const [amount, setAmount] = useState<number>(650.00);
  const [proofBase64, setProofBase64] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const match = students.find(s => 
      s.studentId.toLowerCase() === searchQuery.toLowerCase() ||
      s.fullName.toLowerCase().includes(searchQuery.toLowerCase())
    );
    if (match) {
      setActiveStudent(match);
      setStudentId(match.studentId);
      setFullName(match.fullName);
      setEmail(match.email || "");
    } else {
      alert("Student record not found in clearance roster.");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProofBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProofSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId || !referenceNo || amount <= 0) {
      return alert("Please complete all required fields and enter a valid reference number.");
    }

    setIsSubmitting(true);
    try {
      await submitOnlineRemittance(department, {
        studentId,
        studentName: fullName,
        email: email || "student@example.com",
        paymentChannel: channel, // Fixed: Matches expected action argument signature
        referenceNo,
        particulars: collectionType,
        amount,
        proofBase64,
        ay,
        term
      });

      alert("Payment proof submitted successfully! Pending officer verification in Remittance Queue.");
      setShowProofModal(false);
      setReferenceNo("");
      setProofBase64(null);
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div className="card p-3 border-secondary bg-card mb-4 shadow-sm">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
          <form onSubmit={handleSearch} className="d-flex gap-2 flex-grow-1" style={{ maxWidth: '500px' }}>
            <input 
              type="text" 
              className="form-control bg-card text-color border-secondary" 
              placeholder="Enter student ID or email..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              required
            />
            <button type="submit" className="btn btn-info fw-bold text-dark px-3 d-flex align-items-center gap-1">
              <i className="bi bi-search"></i> Check Clearance
            </button>
          </form>

          <button className="btn btn-success fw-bold d-flex align-items-center gap-2 px-3 py-2" onClick={() => setShowProofModal(true)}>
            <i className="bi bi-upload"></i> Submit Payment Proof
          </button>
        </div>
      </div>

      {activeStudent ? (
        <div className="card p-4 border-secondary bg-card shadow-sm">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <h5 className="fw-bold mb-1 text-white">{activeStudent.fullName}</h5>
              <p className="text-secondary small mb-0 font-monospace">ID: {activeStudent.studentId} | Email: {activeStudent.email || 'N/A'}</p>
            </div>
            <div>
              <span className={`badge fs-6 px-3 py-2 ${activeStudent.isCleared ? 'bg-success' : 'bg-danger'}`}>
                {activeStudent.isCleared ? 'CLEAR' : 'HOLD / UNPAID DUES'}
              </span>
            </div>
          </div>

          <h6 className="text-secondary small fw-semibold mb-2">Unpaid Obligations / Dues</h6>
          {activeStudent.unpaidItems.length === 0 ? (
            <p className="text-success small">No outstanding obligations. Student is fully cleared for {term} ({ay}).</p>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm align-middle text-white">
                <thead>
                  <tr className="text-secondary small border-bottom border-secondary">
                    <th>Category</th><th>Description</th><th className="text-end">Balance Due</th>
                  </tr>
                </thead>
                <tbody>
                  {activeStudent.unpaidItems.map((item, idx) => (
                    <tr key={idx}>
                      <td>{item.category}</td>
                      <td>{item.itemDescription}</td>
                      <td className="text-end text-danger fw-bold">{fmt(item.balanceDue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center text-secondary py-5">
          <i className="bi bi-person-check display-4 mb-2"></i>
          <p className="small">Search for a student above to inspect clearance status or click <strong>Submit Payment Proof</strong> to submit e-wallet receipts.</p>
        </div>
      )}

      {showProofModal && (
        <div className="modal fade show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content card border-secondary bg-dark text-white shadow-lg">
              <div className="modal-header border-secondary">
                <h5 className="modal-title text-accent"><i className="bi bi-shield-lock me-2"></i>Submit GCash / Maya Proof</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowProofModal(false)}></button>
              </div>
              <form onSubmit={handleProofSubmit}>
                <div className="modal-body">
                  <div className="row g-2 mb-3">
                    <div className="col-md-6">
                      <label className="form-label text-secondary small fw-semibold">Student ID</label>
                      <input type="text" className="form-control bg-card text-color border-secondary font-monospace" placeholder="e.g. 22-CECE1-001" value={studentId} onChange={e => setStudentId(e.target.value)} required />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label text-secondary small fw-semibold">Full Name</label>
                      <input type="text" className="form-control bg-card text-color border-secondary" placeholder="SURNAME, FIRSTNAME" value={fullName} onChange={e => setFullName(e.target.value)} required />
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label text-secondary small fw-semibold">Receipt Notification Email</label>
                    <input type="email" className="form-control bg-card text-color border-secondary" placeholder="student@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
                  </div>

                  <div className="row g-2 mb-3">
                    <div className="col-md-6">
                      <label className="form-label text-secondary small fw-semibold">Channel</label>
                      <select className="form-select bg-card text-color border-secondary" value={channel} onChange={e => setChannel(e.target.value)}>
                        <option value="GCash">GCash</option>
                        <option value="Maya">Maya</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label text-secondary small fw-semibold">Reference Number</label>
                      <input type="text" className="form-control bg-card text-color border-secondary font-monospace" placeholder="Ref #" value={referenceNo} onChange={e => setReferenceNo(e.target.value)} required />
                    </div>
                  </div>

                  <div className="row g-2 mb-3">
                    <div className="col-md-6">
                      <label className="form-label text-secondary small fw-semibold">Collection Type</label>
                      <select className="form-select bg-card text-color border-secondary" value={collectionType} onChange={e => setCollectionType(e.target.value)}>
                        <option value="Departmental Fee (Package)">Departmental Fee (Package)</option>
                        <option value="General Assembly Fine">General Assembly Fine</option>
                        <option value="ID Replacement / Miscellaneous">ID Replacement / Miscellaneous</option>
                        <option value="Event Registration">Event Registration</option>
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label text-secondary small fw-semibold">Payment Mode & Amount</label>
                      <div className="input-group">
                        <select className="form-select bg-card text-color border-secondary" style={{ maxWidth: '130px' }} value={paymentMode} onChange={e => setPaymentMode(e.target.value)}>
                          <option value="Full Payment">Full</option>
                          <option value="Installment">Installment</option>
                        </select>
                        <input type="number" step="0.01" className="form-control bg-card text-color border-secondary" value={amount} onChange={e => setAmount(parseFloat(e.target.value) || 0)} required />
                      </div>
                    </div>
                  </div>

                  <div className="alert alert-warning py-2 small mb-3 border-warning">
                    <i className="bi bi-shield-exclamation me-2"></i>
                    <strong>Privacy Notice:</strong> Please blur or black out your personal phone number and remaining wallet balance before uploading.
                  </div>

                  <div className="mb-3">
                    <label className="form-label text-secondary small fw-semibold">Screenshot / Photo of Receipt</label>
                    <input type="file" className="form-control bg-card text-color border-secondary" accept="image/*" onChange={handleFileChange} required />
                  </div>
                </div>

                <div className="modal-footer border-secondary">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowProofModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-success btn-sm fw-bold px-4" disabled={isSubmitting}>
                    {isSubmitting ? "Submitting Proof..." : "Submit Proof"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}