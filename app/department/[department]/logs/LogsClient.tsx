"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

export default function LogsClient({ 
  initialLogs, 
  department, 
  currentPage, 
  totalPages 
}: { 
  initialLogs: any[]; 
  department: string; 
  currentPage: number; 
  totalPages: number; 
}) {
  const [logs, setLogs] = useState(initialLogs);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    setLogs(initialLogs);
  }, [initialLogs]);

  const handlePageChange = (newPage: number) => {
    router.push(`${pathname}?page=${newPage}`);
  };

  return (
    <div className="card p-3 p-md-4 border-secondary shadow-sm bg-card text-color">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
        <div>
          <h5 className="text-accent mb-1 fw-bold">
            <i className="bi bi-journal-text me-2"></i>System Audit Logs
          </h5>
          <p className="text-secondary small mb-0">
            Inspect immutable activity records, user actions, and system events for {department.toUpperCase()}.
          </p>
        </div>
        <button className="btn btn-outline-secondary btn-sm" onClick={() => window.location.reload()}>
          <i className="bi bi-arrow-repeat me-1"></i>Refresh Logs
        </button>
      </div>

      <div className="table-responsive">
        <table className="table table-hover align-middle text-color" style={{ fontSize: '0.88rem' }}>
          <thead>
            <tr className="text-secondary small">
              <th style={{ width: '20%' }}>Timestamp</th>
              <th style={{ width: '15%' }}>User</th>
              <th style={{ width: '25%' }}>Action</th>
              <th style={{ width: '40%' }}>Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.length > 0 ? (
              logs.map((log) => (
                <tr key={log.id}>
                  <td className="small text-secondary font-monospace">{log.timestamp}</td>
                  <td><strong className="text-accent">{log.user}</strong></td>
                  <td>
                    <span className="badge bg-secondary bg-opacity-25 text-info border border-info border-opacity-25 font-monospace">
                      {log.action}
                    </span>
                  </td>
                  <td className="small text-secondary" style={{ wordBreak: 'break-word' }}>{log.details}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="text-center text-secondary py-5">
                  No system audit logs recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="d-flex justify-content-between align-items-center mt-3 pt-3 border-top border-secondary">
          <small className="text-secondary">
            Page {currentPage} of {totalPages}
          </small>
          <div className="btn-group btn-group-sm">
            <button 
              className="btn btn-outline-secondary" 
              disabled={currentPage <= 1}
              onClick={() => handlePageChange(currentPage - 1)}
            >
              <i className="bi bi-chevron-left me-1"></i>Previous
            </button>
            <button 
              className="btn btn-outline-secondary" 
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