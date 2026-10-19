"use client";

import SavePdfButton from "../../../../components/SavePdfButton";

export default function PrintReceiptButton({ orNumber }: { orNumber: string }) {
  return (
    <div className="d-inline-flex gap-2 flex-wrap">
      <button type="button" className="btn btn-primary" onClick={() => window.print()}>
        <i className="bi bi-printer me-1" aria-hidden="true" />Print Receipt
      </button>
      <SavePdfButton className="btn btn-outline-danger" label="Save as PDF" targetSelector="#clear-reprint" fileName={`CLEAR_Receipt_${orNumber}`} />
    </div>
  );
}
