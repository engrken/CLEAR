// app/dashboard/components/ProvisionModal.tsx
"use client";
import { useRef, useState } from "react";
import { useRouter } from 'next/navigation';
import { periodsFor, type CalendarMode } from "@/lib/academic-periods";
import { createDepartment } from "@/app/dashboard/actions";
export default function ProvisionModal() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null); // Added ref for auto-closing
  const [loading, setLoading] = useState(false);
  const [calendarMode, setCalendarMode] = useState<CalendarMode>('Semester');
  const current = new Date();
  const startYear = current.getMonth() >= 5 ? current.getFullYear() : current.getFullYear() - 1;
  const initialAY = `A.Y. ${startYear} - ${startYear + 1}`;
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;
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
        router.refresh();
        setMessage({ text: res.message, type: "success" });
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
        <div className="modal-content bg-body border-secondary text-body shadow-lg clear-theme-modal">
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
              <div className="mt-4 pt-3 border-top border-secondary">
                <h6 className="text-info fw-bold mb-3">3. Initial Academic Calendar</h6>
                <p className="small text-muted">Choose before creating the tenant. Once finances are posted, calendar changes require a controlled period transition.</p>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="legacy-initial-ay">Starting Academic Year</label>
                    <input id="legacy-initial-ay" name="initialAcademicYear" className="form-control" required
                      defaultValue={initialAY} pattern="(?:A\.Y\.\s*)?\d{4}\s*-\s*\d{4}" />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="legacy-calendar-mode">Calendar</label>
                    <select id="legacy-calendar-mode" name="calendarMode" className="form-select" required
                      value={calendarMode} onChange={e => setCalendarMode(e.target.value as CalendarMode)}>
                      <option value="FullYear">Full School Year</option>
                      <option value="Semester">Semester</option>
                      <option value="Trimester">Trimester</option>
                    </select>
                  </div>
                  {calendarMode === "Semester" && <div className="col-12">
                    <label className="form-check-label">
                      <input className="form-check-input me-2" type="checkbox" name="includeSummer" defaultChecked />Include Summer accounting period
                    </label>
                  </div>}
                  <div className="col-12 small text-muted">First accounting period: {periodsFor({mode: calendarMode, includeSummer: true})[0]}</div>
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