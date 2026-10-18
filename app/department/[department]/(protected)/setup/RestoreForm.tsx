// /app/department/[department]/(protected)/setup/RestoreForm.tsx
"use client";
import { clearAlert, clearConfirm, clearPrompt } from "@/lib/clear-dialogs";


import { useState } from "react";
import { useRouter } from "next/navigation";

type RestoreFeedback = {
  kind: "success" | "error";
  message: string;
};

export default function RestoreForm({ organizationId }: { organizationId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<RestoreFeedback | null>(null);

  const handleRestore = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;

    const form = event.currentTarget;
    const fileInput = form.elements.namedItem("backupFile") as HTMLInputElement | null;
    const backupFile = fileInput?.files?.[0];

    if (!backupFile) {
      setFeedback({ kind: "error", message: "Please select an encrypted CLEAR backup file." });
      return;
    }

    if (!await clearConfirm(
      "WARNING: This verified backup will merge and overwrite matching financial records. " +
      "Confirm the organization and take a fresh database snapshot first. Continue?"
    )) {
      return;
    }

    setFeedback(null);
    setLoading(true);
    let restored = false;

    try {
      const formData = new FormData();
      formData.append("backupFile", backupFile);
      formData.append("orgId", organizationId);

      const response = await fetch("/api/restore", {
        method: "POST",
        body: formData,
        cache: "no-store",
      });

      // Surface the server's validation message when available, including
      // authentication failures, tampered files, and missing backup keys.
      let result: { success?: boolean; message?: string } | null = null;
      try {
        result = await response.json();
      } catch {
        // Next.js may return a non-JSON body for unexpected server errors.
      }

      if (!response.ok || result?.success !== true) {
        throw new Error(result?.message || `Restore failed (HTTP ${response.status}).`);
      }

      setFeedback({
        kind: "success",
        message: result.message || "Encrypted backup restored successfully.",
      });
      // Clear the file choice after a successful restore to discourage
      // accidentally submitting the same backup a second time.
      if (fileInput) fileInput.value = "";
      restored = true;
    } catch (error: unknown) {
      setFeedback({
        kind: "error",
        message: error instanceof Error ? error.message : "Unable to complete the restoration.",
      });
    } finally {
      // Do not invoke a blocking alert or window.location.reload() here:
      // the user must see the spinner reset on both success and failure.
      setLoading(false);
    }

    if (restored) {
      // Refresh server-rendered balances/records without destroying the
      // restored feedback message or reloading the browser window.
      router.refresh();
    }
  };

  return (
    <div className="card p-3 border-warning bg-warning bg-opacity-10 shadow-sm mt-3 text-body">
      <form onSubmit={handleRestore} aria-busy={loading}>
        <h6 className="fw-bold text-warning mb-1">
          <i className="bi bi-cloud-arrow-up-fill me-2" />
          Restore Database from Backup
        </h6>
        <small className="text-muted d-block mb-3">
          Upload a verified encrypted CLEAR backup. Modified or legacy plaintext JSON files will be
          rejected. Use only a trusted snapshot from the same organization. (Admin only)
        </small>

        <div className="input-group" style={{ maxWidth: "550px" }}>
          <input
            type="file"
            name="backupFile"
            accept=".encrypted.json,.json,.clearbak"
            className="form-control bg-body text-body border-secondary"
            disabled={loading}
            required
            aria-label="Select an encrypted CLEAR backup file"
          />
          <button
            type="submit"
            className="btn btn-warning fw-bold text-dark"
            disabled={loading}
          >
            {loading ? (
              <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true" />
            ) : (
              <i className="bi bi-upload me-1" />
            )}
            {loading ? "Restoring..." : "Restore Snapshot"}
          </button>
        </div>

        {feedback && (
          <div
            role={feedback.kind === "error" ? "alert" : "status"}
            aria-live={feedback.kind === "error" ? "assertive" : "polite"}
            className={`alert ${feedback.kind === "success" ? "alert-success" : "alert-danger"} mt-3 mb-0`}
          >
            <div>{feedback.message}</div>
            {feedback.kind === "success" && (
              <button
                type="button"
                className="btn btn-sm btn-outline-success mt-2"
                onClick={() => window.location.reload()}
              >
                <i className="bi bi-arrow-clockwise me-1" />
                Reload page
              </button>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
