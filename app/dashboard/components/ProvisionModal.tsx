// app/dashboard/components/ProvisionModal.tsx
"use client";

import { useRef, useState } from "react";
import { createDepartment } from "@/app/dashboard/actions";

export default function ProvisionModal() {
  const formRef = useRef<HTMLFormElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null); // Added ref for auto-closing
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const formData = new FormData(e.currentTarget);
    
    // 1. VERCEL PAYLOAD LIMIT GUARD (Max 2MB)
    const logoFile = formData.get('logo') as File | null;
    if (logoFile && logoFile.size > 2 * 1024 * 1024) {
      setMessage({ text: "Logo file is too large. Please upload an image smaller than 2MB.", type: "error" });
      setLoading(false);
      return;
    }
    
    try {
      const res = await createDepartment(formData);
      if (res.success) {
        formRef.current?.reset();
        setMessage({ text: res.message, type: "success" });
        
        // 3. AUTO-CLOSE UX: Programmatically click the hidden close button after a short delay
        setTimeout(() => {
          closeBtnRef.current?.click();
          setMessage(null); // Reset message for next time
        }, 1200);
        
      } else {
        setMessage({ text: res.message, type: "error" });
      }
    } catch (err: any) {
      setMessage({ text: err.message || "An error occurred while provisioning.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal fade" id="provisionModal" tabIndex={-1} aria-labelledby="provisionModalLabel" aria-hidden="true">
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content bg-dark border-secondary text-white shadow-lg">
          
          <div className="modal-header border-secondary">
            <h5 className="modal-title text-info fw-bold" id="provisionModalLabel">
              <i className="bi bi-hdd-network me-2"></i> Register Department / Organization
            </h5>
            {/* Attached closeBtnRef here */}
            <button ref={closeBtnRef} type="button" className="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>

          <div className="modal-body p-4">
            {message && (
              <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-danger'} py-2 small fw-bold`}>
                {message.text}
              </div>
            )}

            {/* 2. ADDED encType for standard file upload compliance */}
            <form ref={formRef} onSubmit={handleSubmit} encType="multipart/form-data">
              <div className="row g-4">
                
                {/* LEFT COLUMN: Entity Details */}
                <div className="col-12 col-md-6">
                  <h6 className="text-info border-bottom border-secondary pb-2 mb-3">1. Entity Details</h6>
                  
                  <div className="mb-3">
                    <label className="form-label text-secondary small mb-1">Entity Type</label>
                    <select name="type" className="form-select bg-dark text-white border-secondary shadow-none" required>
                      <option value="Department">Academic Department (e.g., Engineering)</option>
                      <option value="Organization">Student Organization (e.g., JIECEP)</option>
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label text-secondary small mb-1">Full Name</label>
                    <input 
                      type="text" 
                      name="name" 
                      className="form-control bg-dark text-white border-secondary shadow-none" 
                      placeholder="Junior Institute of Electronics Engineers of the Philippines - FCU Student Chapter" 
                      required 
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label text-secondary small mb-1">Acronym (System Link)</label>
                    <div className="input-group">
                      <span className="input-group-text bg-secondary text-white border-secondary">/department/</span>
                      <input 
                        type="text" 
                        name="acronym" 
                        className="form-control bg-dark text-white border-secondary font-monospace shadow-none" 
                        placeholder="jiecep" 
                        required 
                      />
                    </div>
                    <div className="form-text text-secondary small mt-1">No spaces. This acts as the secure URL link.</div>
                  </div>
                  
                  <div className="mb-3">
                    <label className="form-label text-secondary small mb-1">Organization Logo (Optional)</label>
                    <input 
                      type="file" 
                      name="logo" 
                      accept="image/png, image/jpeg, image/webp"
                      className="form-control bg-dark text-white border-secondary shadow-none" 
                    />
                    <div className="form-text text-secondary small mt-1">
                      Max file size: 2MB. Recommended format: PNG.
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN: Administrator Details */}
                <div className="col-12 col-md-6">
                  <h6 className="text-warning border-bottom border-secondary pb-2 mb-3">2. Initial Administrator</h6>
                  
                  <div className="mb-3">
                    <label className="form-label text-secondary small mb-1">Admin Full Name</label>
                    <input 
                      type="text" 
                      name="adminName" 
                      className="form-control bg-dark text-white border-secondary shadow-none" 
                      placeholder="Juan Dela Cruz" 
                      required 
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label text-secondary small mb-1">Admin Email Address</label>
                    <input 
                      type="email" 
                      name="adminEmail" 
                      className="form-control bg-dark text-white border-secondary shadow-none" 
                      placeholder="admin@domain.edu.ph" 
                      required 
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label text-secondary small mb-1">Admin Username</label>
                    <input 
                      type="text" 
                      name="adminUsername" 
                      className="form-control bg-dark text-white border-secondary shadow-none" 
                      placeholder="juandelacruz" 
                      required 
                    />
                  </div>
                </div>

              </div>

              <div className="mt-4 pt-3 border-top border-secondary text-end">
                <button type="button" className="btn btn-outline-secondary me-2" data-bs-dismiss="modal">Cancel</button>
                <button type="submit" className="btn btn-primary fw-bold px-4" disabled={loading}>
                  {loading ? (
                    <><span className="spinner-border spinner-border-sm me-2"></span> Provisioning...</>
                  ) : (
                    <><i className="bi bi-shield-lock me-2"></i> Provision Tenant</>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      </div>
    </div>
  );
}