'use client';

import { useEffect } from 'react';

export default function DataPrivacyModal() {
  useEffect(() => {
    const isAccepted = localStorage.getItem("fcu_clear_privacy_accepted");
    if (!isAccepted) {
      const modalEl = document.getElementById("dataPrivacyModal");
      if (modalEl && (window as any).bootstrap) {
        const modal = (window as any).bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
      }
    }
  }, []);

  const acceptDataPrivacy = () => {
    localStorage.setItem("fcu_clear_privacy_accepted", "true");
    const modalEl = document.getElementById("dataPrivacyModal");
    if (modalEl && (window as any).bootstrap) {
      const modal = (window as any).bootstrap.Modal.getInstance(modalEl) || (window as any).bootstrap.Modal.getOrCreateInstance(modalEl);
      modal.hide();
    }
  };

  return (
    <div className="modal fade" id="dataPrivacyModal" data-bs-backdrop="static" data-bs-keyboard="false" tabIndex={-1} aria-labelledby="dataPrivacyTitle" aria-hidden="true">
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content card border-secondary shadow-lg">
          <div className="modal-header border-secondary">
            <h5 className="modal-title text-accent fw-bold" id="dataPrivacyTitle">
              <i className="bi bi-shield-check text-info me-2"></i>Data Privacy Notice & Consent
            </h5>
          </div>
          <div className="modal-body p-4" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            <p className="small text-secondary mb-3">
              In compliance with the <strong>Philippine Data Privacy Act of 2012 (Republic Act No. 10173)</strong>, Filamer Christian University, Inc. is committed to protecting your personal and academic information.
            </p>

            <h6 className="text-info small fw-bold">1. Information We Process</h6>
            <p className="small text-secondary mb-2">
              The Centralized Liquidation of Expenses & Audit Records (CLEAR) portal collects and verifies your Student ID, Full Name, Year Level, Institutional/Personal Email, and financial transaction records (e.g., receipt numbers, fees paid, online remittance slips). <strong>Students are strictly advised to mask or redact their personal mobile numbers and remaining e-wallet balances prior to submitting remittance screenshots.</strong>
            </p>

            <h6 className="text-info small fw-bold">2. Purpose of Processing</h6>
            <p className="small text-secondary mb-2">
              Your data is strictly processed to:
            </p>
            <ul className="small text-secondary ps-3 mb-3">
              <li>Verify departmental fee obligations, penalties, and clearance sign-offs.</li>
              <li>Maintain institutional auditing and treasury accounting ledgers.</li>
              <li>Generate real-time digital clearance verification tokens and QR signatures.</li>
            </ul>

            <h6 className="text-info small fw-bold">3. Access and Storage</h6>
            <p className="small text-secondary mb-0">
              Access to itemized individual ledgers is restricted strictly to authorized and administrative officers. Public lookup displays only clearance sign-off statuses without disclosing detailed itemized transactions.
            </p>
          </div>
          <div className="modal-footer border-secondary d-flex justify-content-between">
            <small className="text-secondary">Filamer Christian University, Inc.</small>
            <button type="button" className="btn btn-info btn-sm fw-bold px-4" id="btnAcceptPrivacy" onClick={acceptDataPrivacy}>
              I Understand & Agree
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}