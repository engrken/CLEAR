import Link from 'next/link';
import type { Metadata } from 'next';
import packageJson from '@/package.json';
import releases from '@/data/releases.json';

export const metadata: Metadata = {
  title: "What's New | CLEAR System",
  description: 'CLEAR System web features, fixes, and release version history.',
};

const labelFor = (kind: string) =>
  kind === 'fix' ? 'Fixes & maintenance' : kind === 'major' ? 'Major update' : 'Features & improvements';

export default function UpdatesPage() {
  const build = (process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || '')
    .trim().slice(0, 7);

  return (
    <main className="container py-5 text-color" style={{ maxWidth: '820px' }}>
      <nav className="mb-4"><Link href="/" className="text-info text-decoration-none">← CLEAR System</Link></nav>
      <header className="mb-5">
        <div className="text-info fw-bold text-uppercase small mb-2">CLEAR System Releases</div>
        <h1 className="fw-bold mb-2">What&apos;s New</h1>
        <p className="text-secondary">Improvements, fixes, and updates to the CLEAR web application.</p>
        <p className="small mb-0"><strong>Current version: v{packageJson.version}</strong>
          {build && <span className="text-secondary ms-2">· deployment build {build}</span>}
        </p>
      </header>
      <section aria-label="Release history">
        {releases.map(entry => (
          <article key={entry.version} className="card p-4 mb-3">
            <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
              <div><span className="text-info small fw-semibold">{labelFor(entry.kind)}</span>
                <h2 className="h5 fw-bold mt-1 mb-0">v{entry.version}</h2></div>
              <time className="small text-secondary" dateTime={entry.date}>
                {new Date(entry.date + 'T12:00:00Z').toLocaleDateString('en-PH', {
                  timeZone: 'Asia/Manila', year: 'numeric', month: 'long', day: 'numeric'
                })}
              </time>
            </div>
            <ul className="mb-0">{entry.changes.map((change, index) => <li key={index} className="mb-1">{change}</li>)}</ul>
          </article>
        ))}
      </section>
      <p className="small text-secondary mt-4">
        Each new deployment has its own Git build identifier. Release versions change only when a
        fix, feature, or major release is intentionally recorded and committed.
      </p>
    </main>
  );
}
