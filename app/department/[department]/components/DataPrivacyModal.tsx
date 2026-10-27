'use client';

import { useEffect, useRef, useState } from 'react';

const CONSENT_KEY = 'clear_privacy_accepted';

/** One global privacy dialog. No Bootstrap instance, backdrop, or body scroll lock. */
export default function DataPrivacyModal() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [needsConsent, setNeedsConsent] = useState(false);
  const [acceptedThisVisit, setAcceptedThisVisit] = useState(false);

  useEffect(() => {
    try {
      setNeedsConsent(window.localStorage.getItem(CONSENT_KEY) !== 'true');
    } catch {
      // Restrictive browsers may disable storage. Acknowledge for this visit.
      setNeedsConsent(true);
    }
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!needsConsent || acceptedThisVisit) {
      if (dialog.open) dialog.close();
      return;
    }
    // The service advisory is allowed to finish first if currently open.
    const showWhenAvailable = () => {
      if (!dialog.open && !document.querySelector('.clear-service-dialog[open]')) {
        dialog.showModal();
      }
    };
    showWhenAvailable();
    const observer = new MutationObserver(showWhenAvailable);
    const advisory = document.querySelector('.clear-service-dialog');
    if (advisory) observer.observe(advisory, { attributes: true, attributeFilter: ['open'] });
    return () => observer.disconnect();
  }, [needsConsent, acceptedThisVisit]);

  const acceptDataPrivacy = () => {
    // Consent is UI-only and does not send a server request under READ_ONLY.
    try { window.localStorage.setItem(CONSENT_KEY, 'true'); } catch { /* per-visit fallback */ }
    setAcceptedThisVisit(true);
    setNeedsConsent(false);
    dialogRef.current?.close();
  };

  return (
    <dialog ref={dialogRef} className="clear-privacy-dialog d-print-none"
      aria-labelledby="dataPrivacyTitle" aria-describedby="dataPrivacyDescription"
      onCancel={event => event.preventDefault()}>
      <div className="clear-privacy-dialog-content">
        <div className="p-4 border-bottom border-secondary">
          <h2 className="h5 text-info fw-bold mb-0" id="dataPrivacyTitle">
            <i className="bi bi-shield-check me-2" aria-hidden="true" />
            Data Privacy Notice &amp; Consent
          </h2>
        </div>
        <div className="p-4 clear-privacy-dialog-body">
          <p id="dataPrivacyDescription" className="small text-secondary mb-3">
            In compliance with the <strong>Philippine Data Privacy Act of 2012 (Republic Act No. 10173)</strong>,
            CLEAR System is committed to protecting your personal and academic information.
          </p>
          <h3 className="h6 text-info small fw-bold">1. Information We Process</h3>
          <p className="small text-secondary mb-2">
            The Centralized Liquidation of Expenses &amp; Audit Records (CLEAR) portal collects and verifies
            your Student ID, Full Name, Year Level, Institutional/Personal Email, and financial transaction
            records (e.g., receipt numbers, fees paid, online remittance slips).
            <strong> Students are strictly advised to mask or redact personal mobile numbers and remaining
            e-wallet balances before submitting remittance screenshots.</strong>
          </p>
          <h3 className="h6 text-info small fw-bold">2. Purpose of Processing</h3>
          <p className="small text-secondary mb-2">Your data is processed to:</p>
          <ul className="small text-secondary ps-3 mb-3">
            <li>Verify departmental fee obligations, penalties, and clearance sign-offs.</li>
            <li>Maintain institutional auditing and treasury accounting ledgers.</li>
            <li>Generate real-time digital clearance verification tokens and QR signatures.</li>
          </ul>
          <h3 className="h6 text-info small fw-bold">3. Access and Storage</h3>
          <p className="small text-secondary mb-0">
            Access to itemized individual ledgers is restricted to authorized and administrative officers.
            Public lookup displays clearance sign-off statuses without detailed itemized transactions.
          </p>
        </div>
        <div className="p-3 p-md-4 border-top border-secondary d-flex gap-3 flex-wrap align-items-center justify-content-between">
          <small className="text-secondary">CLEAR System — Privacy Notice</small>
          <button type="button" id="btnAcceptPrivacy"
            className="btn btn-info fw-bold px-4"
            onClick={acceptDataPrivacy}>
            I Understand &amp; Agree
          </button>
        </div>
      </div>
    </dialog>
  );
}
