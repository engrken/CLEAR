"use client";

/**
 * Client-only PDF creation for authorized CLEAR report views.
 * The bundled converter lives on CLEAR's own origin under /public/vendor.
 * No report data, photos, or personally identifying details are sent to an
 * external conversion service.
 */
type PdfOptions = {
  margin: number[];
  filename: string;
  image: { type: string; quality: number };
  html2canvas: Record<string, unknown>;
  jsPDF: { unit: string; format: number[]; orientation: string; compress: boolean };
  pagebreak: { mode: string[]; avoid: string[] };
};

type PdfWorker = {
  set(options: PdfOptions): PdfWorker;
  from(element: HTMLElement): PdfWorker;
  save(): Promise<void>;
};
type PdfFactory = () => PdfWorker;

let loadPromise: Promise<PdfFactory> | null = null;

function getFactory(): PdfFactory | undefined {
  return (window as Window & { html2pdf?: PdfFactory }).html2pdf;
}

function loadSelfHostedConverter(): Promise<PdfFactory> {
  const loaded = getFactory();
  if (loaded) return Promise.resolve(loaded);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<PdfFactory>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/vendor/html2pdf-0.14.0.bundle.min.js";
    script.async = true;
    script.dataset.clearPdfBundle = "true";

    script.onload = () => {
      const factory = getFactory();
      if (factory) resolve(factory);
      else reject(new Error("The PDF converter did not initialize."));
    };
    script.onerror = () => {
      script.remove();
      reject(new Error("Unable to load the PDF converter. Check your connection."));
    };
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    loadPromise = null;
    throw error;
  });

  return loadPromise;
}

function safePdfName(name: string): string {
  const safe = String(name || "CLEAR_Report")
    .replace(/\.pdf$/i, "")
    .replace(/[^a-zA-Z0-9_ -]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 110) || "CLEAR_Report";
  return safe + ".pdf";
}

function clonePrintableContent(source: HTMLElement): HTMLElement {
  const clone = source.cloneNode(true) as HTMLElement;

  // Elements explicitly omitted from browser print should never leak into PDF.
  clone.querySelectorAll(".d-print-none, .receipt-no-print, [data-html2canvas-ignore='true'], button, input, select, textarea").forEach(el => el.remove());

  // Bootstrap's print-only header and liquidation template are normally
  // invisible outside @media print; reveal them for offscreen PDF rendering.
  const printable = [clone, ...Array.from(clone.querySelectorAll<HTMLElement>("*"))];
  for (const element of printable) {
    if (element.classList.contains("d-print-flex")) {
      element.classList.remove("d-none", "d-print-flex");
      element.classList.add("d-flex");
    } else if (element.classList.contains("d-print-block")) {
      element.classList.remove("d-none", "d-print-block");
      element.classList.add("d-block");
    } else if (element.classList.contains("d-print-inline")) {
      element.classList.remove("d-none", "d-print-inline");
      element.classList.add("d-inline");
    }
    // Read-only reports must not include edit dialogs or hidden controls.
    if (element.hasAttribute("hidden") || element.getAttribute("aria-hidden") === "true") {
      element.remove();
    }
  }

  clone.classList.remove("d-none", "d-print-block", "d-print-flex");
  clone.style.display = "block";
  clone.style.visibility = "visible";
  clone.style.position = "static";
  clone.style.width = "100%";
  clone.style.maxWidth = "none";
  clone.style.minWidth = "0";
  clone.style.height = "auto";
  clone.style.overflow = "visible";
  clone.style.margin = "0";
  clone.style.padding = "0";
  clone.style.border = "0";
  clone.style.boxShadow = "none";
  clone.style.backgroundColor = "#fff";
  clone.style.color = "#111827";
  return clone;
}

export async function downloadReportPdf(
  selector: string,
  fileName: string,
  beforeExport?: () => void | Promise<void>,
): Promise<void> {
  // Start loading on click, but prepare report-specific DOM before capture.
  const converterPromise = loadSelfHostedConverter();
  if (beforeExport) await beforeExport();
  const converter = await converterPromise;

  const source = document.querySelector<HTMLElement>(selector);
  if (!source) {
    throw new Error("The report is not ready for PDF export. Try again.");
  }

  // Keep the temporary staging node off-screen, but export its *inner*
  // unpositioned child. Otherwise an off-screen left offset can be captured
  // by html2canvas, resulting in a blank or clipped downloaded PDF.
  const holder = document.createElement("div");
  holder.style.cssText =
    "position:fixed;left:-25000px;top:0;width:780px;z-index:-1;pointer-events:none;";
  const root = document.createElement("div");
  root.className = "clear-pdf-export";
  root.style.cssText =
    "width:780px;max-width:none;background:#fff;color:#111827;";

  const styles = document.createElement("style");
  styles.textContent = `
    .clear-pdf-export, .clear-pdf-export * {
      color: #111827 !important;
      background-color: transparent !important;
      text-shadow: none !important;
      box-shadow: none !important;
      -webkit-print-color-adjust: exact;
    }
    .clear-pdf-export { background-color: #fff !important; font-family: Arial, sans-serif; }
    .clear-pdf-export .card, .clear-pdf-export .module { border: none !important; }
    .clear-pdf-export .table-responsive { overflow: visible !important; }
    .clear-pdf-export table { width: 100% !important; border-collapse: collapse !important; }
    .clear-pdf-export th, .clear-pdf-export td { border: 1px solid #888 !important; padding: 4px 6px !important; }
    .clear-pdf-export thead { display: table-header-group !important; }
    .clear-pdf-export tr, .clear-pdf-export .signature-block { break-inside: avoid !important; }
    .clear-pdf-export .collection-category-header { break-after: avoid !important; }
    .clear-pdf-export img { max-width: 100% !important; }
    .clear-pdf-export .alert-danger { border: 3px solid #b91c1c !important; font-weight: bold !important; }
  `;

  root.appendChild(styles);
  root.appendChild(clonePrintableContent(source));
  holder.appendChild(root);
  document.body.appendChild(holder);

  try {
    // Allow the cloned report / print-only header layout to settle.
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    await converter().set({
      margin: [12.7, 12.7, 12.7, 12.7],
      filename: safePdfName(fileName),
      image: { type: "jpeg", quality: 0.97 },
      html2canvas: { scale: 2, useCORS: true, allowTaint: false, logging: false, backgroundColor: "#ffffff", scrollY: 0 },
      jsPDF: { unit: "mm", format: [215.9, 330.2], orientation: "portrait", compress: true },
      pagebreak: { mode: ["css", "legacy"], avoid: ["tr", ".signature-block", ".collection-category-header"] },
    }).from(root).save();
  } finally {
    holder.remove();
  }
}
