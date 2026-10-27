import Link from 'next/link';
import MaintenanceBanner from '@/components/MaintenanceBanner';
export const dynamic = 'force-dynamic';
export default function MaintenancePage() {
  return <main className="container min-vh-100 d-flex flex-column align-items-center justify-content-center py-5 text-center">
    <div className="card shadow-lg border-info bg-dark p-4 p-md-5 text-white" style={{ maxWidth: 680 }}>
      <div className="display-5 mb-3" aria-hidden="true">🛠️</div>
      <h1 className="h2">CLEAR is temporarily under maintenance</h1>
      <p className="text-secondary mt-2">
        Student and financial records remain protected. Please return when scheduled service is restored.
      </p>
      <MaintenanceBanner/>
      <p className="small text-secondary mt-3">If you administer CLEAR, use the secure maintenance control page for recovery.</p>
      <Link href="/dashboard/provisions/maintenance" className="btn btn-outline-info mt-2">
        Global Administrator recovery
      </Link>
    </div>
  </main>;
}
