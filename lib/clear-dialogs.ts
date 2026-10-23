"use client";

/**
 * CLEAR's single, theme-adaptive dialog facade.
 * Native window.alert/confirm/prompt cannot be styled or made theme-aware.
 * ThemedAlert.fire preserves the SweetAlert2 result contract used by existing modules.
 * All financial checks and authorization remain in the respective server actions.
 */
import Swal, { type SweetAlertOptions, type SweetAlertResult } from "sweetalert2";

export type ClearDialogKind = "success" | "error" | "warning" | "info";

function styled(options: SweetAlertOptions): SweetAlertOptions {
  const requestedClasses = options.customClass;
  const supplied: Record<string, string> = typeof requestedClasses === "object" && requestedClasses !== null
    ? requestedClasses as Record<string, string>
    : {};
  const popupExtra = typeof requestedClasses === "string"
    ? requestedClasses
    : typeof supplied.popup === "string" ? supplied.popup : "";
  return {
    // Caller options (icons, preConfirm, input validation, etc.) are retained.
    ...options,
    buttonsStyling: false,
    reverseButtons: false,
    focusCancel: options.focusCancel ?? Boolean(options.showCancelButton),
    allowOutsideClick: options.allowOutsideClick ?? !Boolean(options.showCancelButton),
    confirmButtonText: options.confirmButtonText || "OK",
    cancelButtonText: options.cancelButtonText || "Cancel",
    customClass: {
      ...supplied,
      popup: `clear-dialog ${popupExtra}`.trim(),
      title: `clear-dialog-title ${supplied.title || ""}`.trim(),
      htmlContainer: `clear-dialog-copy ${supplied.htmlContainer || ""}`.trim(),
      actions: `clear-dialog-actions ${supplied.actions || ""}`.trim(),
      confirmButton: `clear-dialog-confirm ${supplied.confirmButton || ""}`.trim(),
      cancelButton: `clear-dialog-cancel ${supplied.cancelButton || ""}`.trim(),
      input: `clear-dialog-input ${supplied.input || ""}`.trim(),
    },
  };
}

/** Backwards-compatible SweetAlert API for components migrated from lib/alerts. */
export const ThemedAlert = {
  fire(options: SweetAlertOptions): Promise<SweetAlertResult> {
    return Swal.fire(styled(options));
  },
};

function classify(message: string): ClearDialogKind {
  if (/^(error|failed|unable)|\b(transaction failed|access denied|unauthorized|rejected)\b/i.test(message)) return "error";
  if (/\b(success|saved successfully|recorded successfully|completed|approved|restored successfully|successfully)\b/i.test(message)) return "success";
  if (/\b(required|invalid|please|cannot|insufficient|closed|must|no records|exceeds|warning|already|not found)\b/i.test(message)) return "warning";
  return "info";
}

export async function clearAlert(message: unknown, kind?: ClearDialogKind): Promise<void> {
  const text = String(message ?? "");
  const resolved = kind || classify(text);
  const title: Record<ClearDialogKind, string> = {
    success: "Success", error: "Action Failed", warning: "Attention", info: "Notice",
  };
  await ThemedAlert.fire({ icon: resolved, title: title[resolved], text, confirmButtonText: "OK" });
}

export async function clearConfirm(
  message: unknown,
  options: { title?: string; confirmText?: string; kind?: "warning" | "question" | "info" } = {}
): Promise<boolean> {
  const result = await ThemedAlert.fire({
    icon: options.kind ?? "warning",
    title: options.title ?? "Confirm Action",
    text: String(message ?? ""),
    showCancelButton: true,
    confirmButtonText: options.confirmText ?? "Yes, Continue",
    cancelButtonText: "Cancel",
  });
  return result.isConfirmed;
}

export async function clearPrompt(
  message: unknown,
  options: {
    title?: string;
    placeholder?: string;
    defaultValue?: string;
    multiline?: boolean;
    confirmText?: string;
  } = {}
): Promise<string | null> {
  const result = await ThemedAlert.fire({
    icon: "question",
    title: options.title ?? "Enter Details",
    text: String(message ?? ""),
    input: (options.multiline ?? /reason|justification|explanation/i.test(String(message))) ? "textarea" : "text",
    inputPlaceholder: options.placeholder ?? "Enter details...",
    inputValue: options.defaultValue ?? "",
    showCancelButton: true,
    confirmButtonText: options.confirmText ?? "Continue",
  });
  return result.isConfirmed ? String(result.value ?? "") : null;
}

/**
 * Standard pre-commit review: explain who/what is affected, the resulting
 * record change, and give Cancel focus by default. Not a server authorization.
 */
export async function confirmCommittedChange(args: {
  action: string; target: string; consequence: string;
  destructive?: boolean; confirmText?: string;
}): Promise<boolean> {
  const result = await ThemedAlert.fire({
    icon: args.destructive ? 'warning' : 'question',
    title: args.action,
    text: args.target + '\n\n' + args.consequence + '\n\nProceed?',
    showCancelButton: true,
    allowOutsideClick: false,
    allowEscapeKey: true,
    focusCancel: true,
    confirmButtonText: args.confirmText ?? (args.destructive ? 'Confirm Change' : 'Confirm Transaction'),
    cancelButtonText: 'Cancel',
  });
  return result.isConfirmed;
}

