"use client";

type SavePdfButtonProps = {
  /** Use the same print preparation as the page's ordinary Print button. */
  onClick?: () => void;
  className?: string;
  label?: string;
};

/**
 * Uses the browser's native print-to-PDF destination rather than rasterizing
 * financial reports or uploading potentially sensitive report data to a server.
 *
 * The user chooses "Save as PDF" (or "Microsoft Print to PDF") in the dialog.
 * Browsers do not permit sites to silently select a printer/destination.
 */
export default function SavePdfButton({
  onClick,
  className = "btn btn-outline-danger btn-sm fw-bold",
  label = "Save as PDF",
}: SavePdfButtonProps) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => (onClick ? onClick() : window.print())}
      title="Choose Save as PDF (or Microsoft Print to PDF) as the destination in the print dialog"
      aria-label={label + ". Choose Save as PDF in the browser print dialog."}
    >
      <i className="bi bi-file-earmark-pdf me-1" aria-hidden="true" />
      {label}
    </button>
  );
}
