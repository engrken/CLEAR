"use client";
export default function PrintReceiptButton() {
  return <button type="button" className="btn btn-primary" onClick={() => window.print()}>
    <i className="bi bi-printer me-1"/>Print / Save as PDF
  </button>;
}
