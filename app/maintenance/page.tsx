import type { Metadata } from 'next';
import Link from 'next/link';
import MaintenanceBanner from '@/components/MaintenanceBanner';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Scheduled maintenance | CLEAR System',
  robots: { index: false, follow: false },
};

export default function MaintenancePage() {
  return (
    <main style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: '2rem',
      background: '#0b1220', color: '#f8fafc',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <section role="status" aria-live="polite" style={{
        width: '100%', maxWidth: 560, padding: '2rem',
        border: '1px solid #334155', borderRadius: 16,
        background: '#111c2e',
      }}>
        <p style={{ fontWeight: 700, color: '#7dd3fc', marginBottom: 10 }}>CLEAR SYSTEM</p>
        <h1 style={{ fontSize: '1.8rem', marginTop: 0 }}>Scheduled system maintenance</h1>
        <MaintenanceBanner />
        <p>Account sign-in, student clearance inquiries, and financial transactions are temporarily unavailable while the system is being updated.</p>
        <p>Your existing official receipts and previously recorded payments remain preserved. Please return after maintenance is completed.</p>
        <p style={{ color: '#cbd5e1', fontSize: '0.9rem', marginBottom: 0 }}>
          Do not resubmit a payment solely because the page is unavailable.
        </p>
        <p className="mt-3 mb-0 small"><Link href="/dashboard/provisions/maintenance"
          className="text-info">Global Administrator recovery</Link></p>
      </section>
    </main>
  );
}
