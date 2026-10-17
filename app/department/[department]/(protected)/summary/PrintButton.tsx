"use client";

export default function PrintButton() {
  return (
    <button 
      className="btn btn-primary d-print-none fw-bold d-flex align-items-center gap-2" 
      onClick={() => window.print()}
    >
      <i className="bi bi-printer"></i> Print Official Summary
    </button>
  );
}