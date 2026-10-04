// app/dashboard/error.tsx
'use client'; // Error boundaries must be Client Components

export default function DashboardError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  return (
    <div className="min-vh-100 d-flex flex-column justify-content-center align-items-center bg-dark text-white p-4">
      <div className="card border-danger bg-body p-5 shadow-lg text-center" style={{ maxWidth: '600px' }}>
        <i className="bi bi-exclamation-octagon-fill text-danger mb-3" style={{ fontSize: '3rem' }}></i>
        <h2 className="fw-bold text-danger">Dashboard Server Crash</h2>
        <p className="text-secondary mt-2 mb-4">
          Next.js successfully found the route, but Prisma or Auth.js crashed during execution.
        </p>
        <div className="bg-dark p-3 rounded text-start overflow-auto">
          <code className="text-warning">{error.message}</code>
        </div>
      </div>
    </div>
  );
}