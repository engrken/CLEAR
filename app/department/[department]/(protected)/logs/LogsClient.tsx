// /app/department/[department]/(protected)/logs/LogsClient.tsx


"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

interface LogEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  details: string;
}

export default function LogsClient({ 
  initialLogs, 
  department, 
  currentPage, 
  totalPages 
}: { 
  initialLogs: LogEntry[]; 
  department: string; 
  currentPage: number; 
  totalPages: number; 
}) {
  const [logs, setLogs] = useState<LogEntry[]>(initialLogs);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    setLogs(initialLogs);
  }, [initialLogs]);

  const handlePageChange = (newPage: number) => {
    router.push(`${pathname}?page=${newPage}`);
  };

  // =========================================================
  // EXPORT CSV HANDLER
  // =========================================================
  const handleExportCsv = () => {
    if (!logs || logs.length === 0) {
      return alert("No audit logs available to export.");
    }

    let csv = `Timestamp,User,Action,Details\n`;
    logs.forEach(log => {
      // Escape double quotes to prevent CSV formatting issues
      const cleanDetails = String(log.details || "").replace(/"/g, '""');
      const cleanUser = String(log.user || "").replace(/"/g, '""');
      const cleanAction = String(log.action || "").replace(/"/g, '""');
      
      csv += `"${log.timestamp}","${cleanUser}","${cleanAction}","${cleanDetails}"\n`;
    });

    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `CLEAR_Audit_Logs_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-3 p-md-4">
      {/* HEADER TOOLBAR */}
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
        <div>
          <h5 className="text-info mb-1 fw-bold">
            <i className="bi bi-shield-lock-fill me-2"></i>System Security & Audit Logs
          </h5>
          <p className="text-muted small mb-0">
            Inspect immutable activity records, user actions, and system events for {department}.
          </p>
        </div>
        
        <div className="d-flex align-items-center gap-2">
          <button className="btn btn-outline-info btn-sm fw-semibold" onClick={handleExportCsv}>
            <i className="bi bi-filetype-csv me-1"></i>Export Logs
          </button>
          <button className="btn btn-outline-secondary btn-sm fw-semibold" onClick={() => window.location.reload()}>
            <i className="bi bi-arrow-clockwise me-1"></i>Refresh
          </button>
        </div>
      </div>

      {/* DATA TABLE */}
      <div className="table-responsive">
        <table className="table table-hover align-middle text-body border-secondary" style={{ fontSize: '0.88rem' }}>
          <thead>
            <tr className="text-muted small border-bottom border-secondary">
              <th style={{ width: '20%' }}>Timestamp</th>
              <th style={{ width: '15%' }}>User Identity</th>
              <th style={{ width: '25%' }}>System Action</th>
              <th style={{ width: '40%' }}>Event Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.length > 0 ? (
              logs.map((log) => (
                <tr key={log.id} className="border-bottom border-secondary">
                  <td className="small text-muted font-monospace">{log.timestamp}</td>
                  <td><strong className="text-info">{log.user}</strong></td>
                  <td>
                    <span className="badge bg-body-secondary text-info border border-secondary font-monospace">
                      {log.action}
                    </span>
                  </td>
                  <td className="small text-muted" style={{ wordBreak: 'break-word' }}>{log.details}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="text-center text-muted py-5">
                  <i className="bi bi-folder-x fs-2 d-block mb-2 opacity-50"></i>
                  No system audit logs recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* PAGINATION CONTROLS */}
      {totalPages > 1 && (
        <div className="d-flex justify-content-between align-items-center mt-3 pt-3 border-top border-secondary">
          <small className="text-muted fw-semibold">
            Showing Page {currentPage} of {totalPages}
          </small>
          <div className="btn-group btn-group-sm">
            <button 
              className="btn btn-outline-secondary fw-bold" 
              disabled={currentPage <= 1}
              onClick={() => handlePageChange(currentPage - 1)}
            >
              <i className="bi bi-chevron-left me-1"></i>Prev
            </button>
            <button 
              className="btn btn-outline-secondary fw-bold" 
              disabled={currentPage >= totalPages}
              onClick={() => handlePageChange(currentPage + 1)}
            >
              Next<i className="bi bi-chevron-right ms-1"></i>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}