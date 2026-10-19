// /app/department/[department]/(protected)/setup/EditLogoForm.tsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateEntityLogo } from "./actions";
import OrganizationLogo from "@/components/OrganizationLogo";

export default function EditLogoForm({ 
  organizationId, 
  currentLogo 
}: { 
  organizationId: string, 
  currentLogo?: string | null 
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const formData = new FormData(e.currentTarget);
    // Securely attach the organization ID to the form data
    formData.append("organizationId", organizationId); 
    
    // Keep payload below Next.js Server Actions default 1 MB body limit.
    const logoFile = formData.get('logo') as File | null;
    if (logoFile && logoFile.size > 850 * 1024) {
      setMessage({ text: "Logo file is too large. Please upload an image smaller than 850 KB.", type: "error" });
      setLoading(false);
      return;
    }
    
    try {
      const res = await updateEntityLogo(formData);
      setMessage({ text: res.message, type: res.success ? "success" : "error" });
      
      // If successful, reset the file input
      if (res.success) {
        (e.target as HTMLFormElement).reset();
        router.refresh();
      }
    } catch (err: any) {
      setMessage({ text: "An error occurred while uploading.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    // 2. ADDED encType="multipart/form-data"
    <form onSubmit={handleSubmit} encType="multipart/form-data" className="p-3 border border-secondary rounded text-body shadow-sm">
      <h6 className="mb-3 text-info fw-bold">
        <i className="bi bi-cloud-upload me-2"></i>Upload New Logo
      </h6>
      
      <div className="mb-3 d-flex align-items-center gap-3 border-bottom border-secondary pb-3">
        <div className="rounded p-1" style={{ width: '50px', height: '50px' }}>
          <OrganizationLogo
            src={currentLogo}
            alt={currentLogo ? "Current organization logo" : "Default CLEAR logo"}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>
        <span className="small text-secondary fw-semibold">
          {currentLogo ? "Current active organization logo" : "Default CLEAR logo (no custom logo uploaded)"}
        </span>
      </div>

      {message && (
        <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-danger'} py-2 small fw-bold`}>
          {message.text}
        </div>
      )}

      <div className="mb-3">
        <label className="form-label small text-secondary">Select Image File</label>
        <input 
          type="file" 
          name="logo" 
          accept="image/png, image/jpeg, image/webp"
          className="form-control bg-card border-secondary shadow-none form-control-sm" 
          required
        />
        <div className="form-text text-secondary small mt-1">
          Max file size: 850 KB (Server Action). Recommended format: PNG.
        </div>
      </div>

      <button type="submit" className="btn btn-primary btn-sm fw-bold w-100" disabled={loading}>
        {loading ? (
          <><span className="spinner-border spinner-border-sm me-2"></span>Uploading...</>
        ) : (
          <><i className="bi bi-check-circle me-1"></i> Replace Logo</>
        )}
      </button>
    </form>
  );
}