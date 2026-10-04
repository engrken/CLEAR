// app/admin/layout.tsx
import AdminOtpModal from './components/AdminOtpModal';
import '@/app/globals.css';
import Script from 'next/script';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-body text-body min-vh-100 d-flex flex-column" data-bs-theme="dark">
      {/* Next.js will safely hoist these links to the document head */}
      <link 
        href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" 
        rel="stylesheet" 
      />
      <link 
        rel="stylesheet" 
        href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" 
      />
      
      {/* Main View Area */}
      <main className="flex-grow-1 d-flex flex-column justify-content-center align-items-center p-3">
        {children}
      </main>

      {/* Global Admin OTP Modal Mount */}
      <AdminOtpModal />

      {/* REQUIRED: Bootstrap JS for Modal triggers */}
      <Script 
        src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js" 
        strategy="lazyOnload"
      />
    </div>
  );
}