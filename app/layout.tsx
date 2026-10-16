// app/layout.tsx
import Script from 'next/script';
import { Analytics } from '@vercel/analytics/next';
import '@/app/globals.css';
import DataPrivacyModal from "@/app/department/[department]/components/DataPrivacyModal";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" />
        <Script id="theme-initializer" strategy="beforeInteractive">
          {`
            try {
              const theme = localStorage.getItem('fcu_clear_theme') || 'dark';
              document.documentElement.setAttribute('data-bs-theme', theme);
            } catch (e) {}
          `}
        </Script>
      </head>
      <body className="bg-body text-body min-vh-100 d-flex flex-column">
        {/* Global Content Mount Point */}
        {children}
        
        {/* Components must be strictly inside the body */}
        <DataPrivacyModal />
        
        <Analytics />
        
        <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js" async />
		
		<script
  dangerouslySetInnerHTML={{
    __html: `
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', function() {
          navigator.serviceWorker.register('/sw.js').then(
            function(registration) {
              console.log('ServiceWorker registration successful');
            },
            function(err) {
              console.log('ServiceWorker registration failed: ', err);
            }
          );
        });
      }
    `,
  }}
/>
      </body>
    </html>
  );
}