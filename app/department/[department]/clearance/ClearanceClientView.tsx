// /app/department/[department]/clearance/ClearanceClientView.tsx

"use client";
import { clearAlert, clearConfirm, clearPrompt } from "@/lib/clear-dialogs";


import { useState } from "react";
import { submitOnlineRemittance } from "../(protected)/remittances/actions";

export default function ClearanceClientView({
  department,
  ay,
  term,
  defaultStudentId,
  defaultFullName,
  defaultEmail,
  feeOptions,
  packageRate,
  closed = false
}: {
  department: string;
  ay: string;
  term: string;
  defaultStudentId: string;
  defaultFullName: string;
  defaultEmail: string;
  feeOptions: { category: string; name: string; amount: number }[];
  packageRate: number;
  closed?: boolean;
}) {
  const [showProofModal, setShowProofModal] = useState(false);
  const [studentId, setStudentId] = useState(defaultStudentId);
  const [fullName, setFullName] = useState(defaultFullName);
  const [email, setEmail] = useState(defaultEmail);
  const [channel, setChannel] = useState("GCash");
  const [referenceNo, setReferenceNo] = useState("");
  
  // The selection includes an explicit Fee Setup category.
  const [selectedFeeIndex, setSelectedFeeIndex] = useState(0);
  const selectedFee = feeOptions[selectedFeeIndex];
  const [paymentModeUI, setPaymentModeUI] = useState("Full Payment");
  const [amount, setAmount] = useState<number>(feeOptions[0]?.amount ?? packageRate);

  const handleCollectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const index = Number(e.target.value);
    const choice = feeOptions[index];
    if (!choice) return;
    setSelectedFeeIndex(index);
    setAmount(choice.amount);
  };

  const [proofFile, setProofFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024 || !["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
        void clearAlert("Receipt must be a PNG, JPEG or WebP image under 5MB.");
        setProofFile(null);
        return;
      }
      setProofFile(file);
    }
  };

  const handleProofSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (closed) return void clearAlert("Online payment submissions are closed for this term.");
    if (!studentId || !referenceNo || !proofFile || !Number.isFinite(amount) || amount <= 0) {
      return void clearAlert("Please complete all required fields and attach a receipt file.");
    }

    if (!selectedFee?.category || !selectedFee.name) {
      return void clearAlert("Select a configured fee before submitting a payment proof.");
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("studentId", studentId);
      formData.append("studentName", fullName || "Student");
      formData.append("email", email);
      formData.append("paymentChannel", channel);
      formData.append("referenceNo", referenceNo);
      formData.append("particulars", selectedFee.name);
      formData.append("category", selectedFee.category);
      formData.append("amount", amount.toString());
      formData.append("ay", ay);
      formData.append("term", term);
      formData.append("paymentMode", paymentModeUI);
      formData.append("receipt", proofFile);

      await submitOnlineRemittance(department, formData);

      void clearAlert("Payment proof submitted successfully! Pending officer verification in Remittance Queue.");
      setShowProofModal(false);
      setReferenceNo("");
      setProofFile(null);

    } catch (err: any) {
      void clearAlert("Error: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="card p-3 border-info mt-4 bg-info bg-opacity-10 shadow-sm text-body">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
          <div>
            <h6 className="text-info fw-bold mb-1"><i className="bi bi-qr-code me-2"></i>Paid via GCash or Maya?</h6>
            <small className="text-muted">Upload your e-wallet transaction receipt for official verification and clearance sign-off.</small>
          </div>
          <button className="btn btn-success fw-bold text-dark d-flex align-items-center gap-2" onClick={() => setShowProofModal(true)} disabled={closed}>
            <i className="bi bi-upload"></i> Submit Payment Proof
          </button>
        </div>
      </div>

      {showProofModal && (
        <div className="modal fade show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content card border-secondary bg-body text-body shadow-lg clear-theme-modal">
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
                      <label className="form-label text-muted small fw-semibold">Payment Channel</label>
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
                      <select className="form-select bg-body text-body border-secondary mb-2" value={selectedFeeIndex} onChange={handleCollectionChange} required>
                        {feeOptions.length === 0 && <option value="">No payable fees configured</option>}
                        {feeOptions.map((fee, idx) => (
                          <option key={`${fee.category}-${fee.name}-${idx}`} value={idx}>{fee.category} — {fee.name}</option>
                        ))}
                      </select>
                      <small className="text-muted">Only configured fees are accepted. Penalties and donations need a separate authorized workflow.</small>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label text-muted small fw-semibold">Payment Mode & Amount</label>
                      <div className="input-group">
                        <select className="form-select bg-body-secondary text-body border-secondary" style={{ maxWidth: '130px' }} value={paymentModeUI} onChange={e => setPaymentModeUI(e.target.value)}>
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
                    <input type="file" className="form-control bg-body text-body border-secondary" accept="image/png,image/jpeg,image/webp" onChange={handleFileChange} required />
                  </div>
                </div>

                <div className="modal-footer border-secondary bg-body-secondary">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowProofModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-success btn-sm fw-bold px-4 text-dark" disabled={isSubmitting || closed || !selectedFee}>
                    {isSubmitting ? "Submitting Proof..." : "Submit Payment Proof"}
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