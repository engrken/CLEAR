"use client";

import { useState } from "react";
import { downloadReportPdf } from "@/lib/pdf-download.client";

type SavePdfButtonProps = {
  /** CSS selector of the report or receipt to export, not the dashboard. */
  targetSelector: string;
  fileName: string;
  /** Use for a report rendered only after a selected record is prepared. */
  beforeExport?: () => void | Promise<void>;
  className?: string;
  label?: string;
};

/**
 * Downloads a real PDF using a self-hosted browser converter.
 * Unlike Print, this never invokes the browser print dialog.
 */
export default function SavePdfButton({
  targetSelector,
  fileName,
  beforeExport,
  className = "btn btn-outline-danger btn-sm fw-bold",
  label = "Save as PDF",
}: SavePdfButtonProps) {
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await downloadReportPdf(targetSelector, fileName, beforeExport);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown PDF export error.";
      window.alert("Unable to download PDF: " + message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      className={className}
      onClick={() => { void save(); }}
      disabled={busy}
      aria-busy={busy}
      title="Download a PDF file directly to your device"
    >
      <i className={`bi ${busy ? "bi-hourglass-split" : "bi-file-earmark-pdf"} me-1`} aria-hidden="true" />
      {busy ? "Creating PDF…" : label}
    </button>
  );
}
