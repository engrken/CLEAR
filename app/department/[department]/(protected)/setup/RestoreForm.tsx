// /app/department/[department]/(protected)/setup/RestoreForm.tsx
"use client";

import { useState } from "react";

export default function RestoreForm({ organizationId }: { organizationId: string }) {
  const [loading, setLoading] = useState(false);

  const handleRestore = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fileInput = form.elements.namedItem('backupFile') as HTMLInputElement;
    if (!fileInput.files?.[0]) return alert('Please select a JSON backup file.');

    if (!confirm('WARNING: Restoring a backup will merge and update existing records in the database. Proceed?')) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('backupFile', fileInput.files[0]);
    formData.append('orgId', organizationId);

    try {
      const res = await fetch('/api/restore', {
        method: 'POST',
        body: formData,
      });
      const result = await res.json();
      if (result.success) {
        alert(result.message || 'Backup restored successfully!');
        window.location.reload();
      } else {
        alert('Restoration failed: ' + result.message);
      }
    } catch (err: any) {
      alert('An error occurred during restoration: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card p-3 border-warning bg-warning bg-opacity-10 shadow-sm mt-3 text-body">
      <form onSubmit={handleRestore}>
        <h6 className="fw-bold text-warning mb-1">
          <i className="bi bi-cloud-arrow-up-fill me-2"></i>Restore Database from Backup
        </h6>
        <small className="text-muted d-block mb-3">
          Upload a previously exported CLEAR System JSON backup file to restore students, collections, and records. (Admin only)
        </small>
        <div className="input-group" style={{ maxWidth: '550px' }}>
          <input type="file" name="backupFile" accept=".json" className="form-control bg-body text-body border-secondary" required />
          <button type="submit" className="btn btn-warning fw-bold text-dark" disabled={loading}>
            {loading ? <span className="spinner-border spinner-border-sm me-1"></span> : <i className="bi bi-upload me-1"></i>}
            {loading ? "Restoring..." : "Restore Snapshot"}
          </button>
        </div>
      </form>
    </div>
  );
}