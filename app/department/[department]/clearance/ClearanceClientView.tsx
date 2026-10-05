"use client";

import { useState } from "react";
import { submitOnlineRemittanceDirect } from "./actions";
import { ThemedAlert } from '@/lib/alerts';

export default function ClearanceClientView({
  department,
  ay,
  term,
  defaultStudentId,
  defaultFullName,
  defaultEmail
}: {
  department: string;
  ay: string;
  term: string;
  defaultStudentId: string;
  defaultFullName: string;
  defaultEmail: string;
}) {
  const [showProofModal, setShowProofModal] = useState(false);
  const [studentId, setStudentId] = useState(defaultStudentId);
  const [fullName, setFullName] = useState(defaultFullName);
  const [email, setEmail] = useState(defaultEmail);
  const [channel, setChannel] = useState("GCash");
  const [referenceNo, setReferenceNo] = useState("");
  const [collectionType, setCollectionType] = useState("Departmental Fee (Package)");
  const [paymentMode, setPaymentMode] = useState("Full Payment");
  const [amount, setAmount] = useState<number>(650.00);
  const [proofBase64, setProofBase64] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    if (!studentId || !referenceNo || !proofBase64 || amount <= 0) {
      return alert("Please complete all required fields and attach a receipt file.");
    }

    setIsSubmitting(true);
    try {
      await submitOnlineRemittanceDirect(department, {
        studentId,
        studentName: fullName || "Student",
        email: email || "student@example.com",
        channel, // Fixed: Matches the expected type signature
        referenceNo,
        collectionType,
        paymentMode,
        amount,
        proofBase64: proofBase64,
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
    <>
      <div className="card p-3 border-info mt-4 bg-info bg-opacity-10 shadow-sm">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
          <div>
            <h6 className="text-info fw-bold mb-1"><i className="bi bi-qr-code me-2"></i>Paid via GCash or Maya?</h6>
            <small className="text-secondary">Upload your e-wallet transaction receipt for official verification and clearance sign-off.</small>
          </div>
          <button className="btn btn-success fw-bold d-flex align-items-center gap-2" onClick={() => setShowProofModal(true)}>
            <i className="bi bi-upload"></i> Submit Payment Proof
          </button>
        </div>
      </div>

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
                      <input 
                        type="text" 
                        className="form-control bg-card text-color border-secondary font-monospace" 
                        placeholder="e.g. 22-CECE1-001" 
                        value={studentId} 
                        onChange={e => setStudentId(e.target.value)} 
                        required 
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label text-secondary small fw-semibold">Full Name</label>
                      <input 
                        type="text" 
                        className="form-control bg-card text-color border-secondary" 
                        placeholder="SURNAME, FIRSTNAME" 
                        value={fullName} 
                        onChange={e => setFullName(e.target.value)} 
                        required 
                      />
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label text-secondary small fw-semibold">Receipt Notification Email</label>
                    <input 
                      type="email" 
                      className="form-control bg-card text-color border-secondary" 
                      placeholder="student@example.com" 
                      value={email} 
                      onChange={e => setEmail(e.target.value)} 
                      required 
                    />
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
                      <input 
                        type="text" 
                        className="form-control bg-card text-color border-secondary font-monospace" 
                        placeholder="Ref #" 
                        value={referenceNo} 
                        onChange={e => setReferenceNo(e.target.value)} 
                        required 
                      />
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
                        <input 
                          type="number" 
                          step="0.01" 
                          className="form-control bg-card text-color border-secondary" 
                          value={amount} 
                          onChange={e => setAmount(parseFloat(e.target.value) || 0)} 
                          required 
                        />
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
    </>
  );
}