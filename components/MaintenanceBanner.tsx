'use client';
import { useEffect, useState } from 'react';

type Status = {
  mode: string; reason: string; scope: string; effectiveUntil: string | null;
  notices: { id: string; title: string; message: string; startsAt: string;
    endsAt: string; revision: number; state: string }[];
};
const pht = (s: string) => new Date(s).toLocaleString('en-PH', {
  timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short',
}) + ' PHT';
function currentTenant(): string | null {
  const slug = /^\/department\/([a-z0-9-]+)/.exec(window.location.pathname);
  return slug ? slug[1] : null;
}

export default function MaintenanceBanner() {
  const [data, setData] = useState<Status | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);
  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        const tenant = currentTenant();
        const url = '/api/maintenance/status' + (tenant ? '?tenant=' + encodeURIComponent(tenant) : '');
        const res = await fetch(url, { cache: 'no-store', credentials: 'same-origin' });
        const payload = await res.json();
        if (!alive) return;
        if (res.ok) setData(payload as Status);
        else setData(null);
      } catch { if (alive) setData(null); }
    };
    void refresh();
    const interval = window.setInterval(() => { void refresh(); }, 45000);
    const resume = () => { void refresh(); };
    document.addEventListener('visibilitychange', resume);
    return () => { alive = false; window.clearInterval(interval);
      document.removeEventListener('visibilitychange', resume); };
  }, []);
  if (!data || (data.mode === 'NORMAL' && !data.notices.length)) return null;
  const items = data.notices.filter(n => !dismissed.includes(n.id + ':' + n.revision));
  return <div className="container py-2" role="region" aria-label="CLEAR service status">
    {data.mode !== 'NORMAL' ? <div className="alert alert-warning" role="alert">
      <strong>{data.mode === 'FULL' ? 'Maintenance in progress' : 'Read-only maintenance active'}</strong>
      <div>{data.reason || 'CLEAR service updates are in progress.'}</div>
      {data.effectiveUntil ? <small>Expected maximum window: {pht(data.effectiveUntil)}</small> : null}
    </div> : null}
    {items.map(n => <div className="alert alert-info d-flex justify-content-between gap-3 align-items-start"
      key={n.id + ':' + n.revision} role={n.state === 'ACTIVE' ? 'alert' : 'status'}>
      <div><strong>{n.title}</strong>
        <div>{n.message}</div>
        <small>Scheduled: {pht(n.startsAt)} – {pht(n.endsAt)} · {n.state}</small>
      </div>
      {n.state !== 'ACTIVE' ? <button type="button" className="btn btn-sm btn-outline-info"
        onClick={() => setDismissed(old => [...old, n.id + ':' + n.revision])}
        aria-label={'Dismiss ' + n.title}>Dismiss</button> : null}
    </div>)}
  </div>;
}
