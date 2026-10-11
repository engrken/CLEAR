// /[department]/clearance/ClearanceManager.tsx

"use client";

import { useState } from "react";
import { fmt } from "@/lib/utils";
import { submitOnlineRemittance } from "../(protected)/remittances/actions";

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
  students,
  feeOptions,
  packageRate
}: {
  department: string;
  ay: string;
  term: string;
  students: StudentClearance[];
  feeOptions: { name: string; amount: number }[]; // <-- UPGRADED
  packageRate: number;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeStudent, setActiveStudent] = useState<StudentClearance | null>(null);

  const [showProofModal, setShowProofModal] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [channel, setChannel] = useState("GCash");
  const [referenceNo, setReferenceNo] = useState("");
  
  // DYNAMIC COLLECTION LOGIC
  const [collectionType, setCollectionType] = useState(feeOptions[0]?.name || "Departmental Fee (Full Package)");
  const [customCollectionType, setCustomCollectionType] = useState("");
  
  const [paymentMode, setPaymentMode] = useState("Full Payment");
  const [amount, setAmount] = useState<number>(feeOptions[0]?.amount || packageRate);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // AUTO-UPDATES AMOUNT WHEN DROPDOWN CHANGES
  const handleCollectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setCollectionType(val);
    if (val === "Other" || val === "Penalty Arrears") {
      setAmount(0);
    } else {
      const matched = feeOptions.find(f => f.name === val);
      if (matched) setAmount(matched.amount);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const match = students.find(s => 
      s.studentId.toLowerCase() === searchQuery.toLowerCase() ||
      (s.email && s.email.toLowerCase() === searchQuery.toLowerCase())
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
    if (file) setProofFile(file);
  };

  const handleProofSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId || !referenceNo || !proofFile || amount <= 0) {
      return alert("Please complete all required fields and upload a valid receipt file.");
    }

    const finalParticulars = collectionType === "Other" ? customCollectionType.trim() : collectionType;
    if (!finalParticulars) {
      return alert("Please specify what this payment is for.");
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("studentId", studentId);
      formData.append("studentName", fullName);
      formData.append("email", email || "student@example.com");
      formData.append("paymentChannel", channel);
      formData.append("referenceNo", referenceNo);
      formData.append("particulars", finalParticulars);
      formData.append("amount", amount.toString());
      formData.append("ay", ay);
      formData.append("term", term);
      formData.append("receipt", proofFile);

      await submitOnlineRemittance(department, formData);

      alert("Payment proof submitted successfully! Pending officer verification in Remittance Queue.");
      setShowProofModal(false);
      setReferenceNo("");
      setProofFile(null);
      setCustomCollectionType("");
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div className="card p-3 border-secondary bg-body-secondary mb-4 shadow-sm text-body">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
          <form onSubmit={handleSearch} className="d-flex gap-2 flex-grow-1" style={{ maxWidth: '500px' }}>
            <input 
              type="text" 
              className="form-control bg-body text-body border-secondary" 
              placeholder="Enter student ID or email..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              required
            />
            <button type="submit" className="btn btn-info fw-bold text-dark px-3 d-flex align-items-center gap-1">
              <i className="bi bi-search"></i> Check Clearance
            </button>
          </form>

          <button className="btn btn-success fw-bold text-dark d-flex align-items-center gap-2 px-3 py-2" onClick={() => setShowProofModal(true)}>
            <i className="bi bi-upload"></i> Submit Payment Proof
          </button>
        </div>
      </div>

      {activeStudent ? (
        <div className="card p-4 border-secondary bg-body shadow-sm text-body">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <h5 className="fw-bold mb-1">{activeStudent.fullName}</h5>
              <p className="text-muted small mb-0 font-monospace">ID: {activeStudent.studentId} | Email: {activeStudent.email || 'N/A'}</p>
            </div>
            <div>
              <span className={`badge fs-6 px-3 py-2 ${activeStudent.isCleared ? 'bg-success text-white' : 'bg-danger text-white'}`}>
                {activeStudent.isCleared ? 'CLEAR' : 'HOLD / UNPAID DUES'}
              </span>
            </div>
          </div>

          <h6 className="text-muted small fw-semibold mb-2">Unpaid Obligations / Dues</h6>
          {activeStudent.unpaidItems.length === 0 ? (
            <p className="text-success small fw-semibold">No outstanding obligations. Student is fully cleared for {term} ({ay}).</p>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm align-middle text-body border-secondary">
                <thead>
                  <tr className="text-muted small border-bottom border-secondary">
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
        <div className="text-center text-muted py-5">
          <i className="bi bi-person-check display-4 mb-2 opacity-50"></i>
          <p className="small">Search for a student above to inspect clearance status or click <strong>Submit Payment Proof</strong> to submit e-wallet receipts.</p>
        </div>
      )}

      {/* PROOF MODAL */}
      {showProofModal && (
        <div className="modal fade show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content card border-secondary bg-body text-body shadow-lg">
              <div className="modal-header border-secondary">
                <h5 className="modal-title fw-bold text-success"><i className="bi bi-shield-lock-fill me-2"></i>Submit Payment Proof</h5>
                <button type="button" className="btn-close" onClick={() => setShowProofModal(false)}></button>
              </div>
              <form onSubmit={handleProofSubmit}>
                <div className="modal-body">
                  <div className="row g-2 mb-3">
                    <div className="col-md-6">
                      <label className="form-label text-muted small fw-semibold">Student ID</label>
                      <input type="text" className="form-control bg-body text-body border-secondary font-monospace" placeholder="e.g. 22-CECE1-001" value={studentId} onChange={e => setStudentId(e.target.value)} required />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label text-muted small fw-semibold">Full Name</label>
                      <input type="text" className="form-control bg-body text-body border-secondary" placeholder="SURNAME, FIRSTNAME" value={fullName} onChange={e => setFullName(e.target.value)} required />
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label text-muted small fw-semibold">Receipt Notification Email</label>
                    <input type="email" className="form-control bg-body text-body border-secondary" placeholder="student@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
                  </div>

                  <div className="row g-2 mb-3">
                    <div className="col-md-6">
                      <label className="form-label text-muted small fw-semibold">Channel</label>
                      <select className="form-select bg-body text-body border-secondary" value={channel} onChange={e => setChannel(e.target.value)}>
                        <option value="GCash">GCash</option>
                        <option value="Maya">Maya</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label text-muted small fw-semibold">Reference Number</label>
                      <input type="text" className="form-control bg-body text-body border-secondary font-monospace" placeholder="Ref #" value={referenceNo} onChange={e => setReferenceNo(e.target.value)} required />
                    </div>
                  </div>

                  <div className="row g-2 mb-3">
                    <div className="col-md-6">
                      <label className="form-label text-muted small fw-semibold">Collection Type / Particulars</label>
                      <select className="form-select bg-body text-body border-secondary mb-2" value={collectionType} onChange={handleCollectionChange}>
                        {feeOptions.map((fee, idx) => (
                          <option key={idx} value={fee.name}>{fee.name}</option>
                        ))}
                        <option value="Penalty Arrears">Penalty Arrears</option>
                        <option value="Other">Other (Please specify...)</option>
                      </select>
                      {/* CONDITIONAL RENDER FOR 'OTHER' */}
                      {collectionType === "Other" && (
                        <input type="text" className="form-control bg-body-secondary text-body border-secondary" placeholder="Type specific payment reason..." value={customCollectionType} onChange={e => setCustomCollectionType(e.target.value)} required autoFocus />
                      )}
                    </div>
                    <div className="col-md-6">
                      <label className="form-label text-muted small fw-semibold">Payment Mode & Amount</label>
                      <div className="input-group">
                        <select className="form-select bg-body-secondary text-body border-secondary" style={{ maxWidth: '130px' }} value={paymentMode} onChange={e => setPaymentMode(e.target.value)}>
                          <option value="Full Payment">Full</option>
                          <option value="Installment">Installment</option>
                        </select>
                        <input type="number" step="0.01" className="form-control bg-body text-body border-secondary fw-bold" value={amount} onChange={e => setAmount(parseFloat(e.target.value) || 0)} required />
                      </div>
                    </div>
                  </div>

                  <div className="alert border-warning bg-warning bg-opacity-10 text-warning py-2 small mb-3 shadow-sm">
                    <i className="bi bi-shield-exclamation me-2"></i>
                    <strong>Privacy Notice:</strong> Please blur or black out your personal phone number and remaining wallet balance before uploading.
                  </div>

                  <div className="mb-3">
                    <label className="form-label text-muted small fw-semibold">Screenshot / Photo of Receipt</label>
                    <input type="file" className="form-control bg-body text-body border-secondary" accept="image/*" onChange={handleFileChange} required />
                  </div>
                </div>

                <div className="modal-footer border-secondary bg-body-secondary">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowProofModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-success btn-sm fw-bold px-4 text-dark" disabled={isSubmitting}>
                    {isSubmitting ? "Submitting Proof..." : "Submit Payment Proof"}
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