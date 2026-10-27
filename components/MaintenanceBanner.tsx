'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { tenantFromLocation } from '@/lib/maintenance/rules';
import { isMaintenanceEntryPath, maintenanceAdvisoryKey, maintenanceSummary,
  type PublicMaintenanceStatus } from '@/lib/maintenance/notice-ui';

const pht = (value: string) => new Date(value).toLocaleString('en-PH', {
  timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short',
}) + ' PHT';

/** Public advisory only. The proxy and server actions independently enforce maintenance. */
export default function MaintenanceBanner() {
  const pathname = usePathname();
  const [snapshot, setSnapshot] = useState<{ path: string; data: PublicMaintenanceStatus } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const lastAutoPrompt = useRef('');

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        const tenant = tenantFromLocation(pathname, window.location.hostname);
        const endpoint = '/api/maintenance/status' +
          (tenant ? '?tenant=' + encodeURIComponent(tenant) : '');
        const res = await fetch(endpoint, { cache: 'no-store', credentials: 'same-origin' });
        if (!res.ok) throw new Error('Maintenance status request failed');
        const data = await res.json() as PublicMaintenanceStatus;
        if (alive) setSnapshot({ path: pathname, data });
      } catch {
        if (alive) setSnapshot(null); // Never claim NORMAL on an unknown state.
      }
    };
    void refresh();
    const interval = window.setInterval(() => { void refresh(); }, 45000);
    const resume = () => { void refresh(); };
    document.addEventListener('visibilitychange', resume);
    return () => {
      alive = false;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [pathname]);

  const data = snapshot?.path === pathname ? snapshot.data : null;
  const tenant = typeof window !== 'undefined'
    ? tenantFromLocation(pathname, window.location.hostname) : null;
  const advisoryKey = data ? maintenanceAdvisoryKey(data, tenant) : '';

  // A fresh notice/revision or maintenance mode can prompt once at a public entry
  // point. Never repeatedly interrupt authenticated financial work or navigation.
  useEffect(() => {
    if (!data || !advisoryKey || !isMaintenanceEntryPath(pathname) ||
        lastAutoPrompt.current === advisoryKey) return;
    lastAutoPrompt.current = advisoryKey;
    try {
      if (window.sessionStorage.getItem(advisoryKey) === 'acknowledged') return;
    } catch { /* Browser storage may be disabled; keep the modal usable. */ }
    setModalOpen(true);
  }, [advisoryKey, data, pathname]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (modalOpen && !dialog.open) dialog.showModal();
    else if (!modalOpen && dialog.open) dialog.close();
  }, [modalOpen]);

  const acknowledge = () => {
    if (advisoryKey) {
      try { window.sessionStorage.setItem(advisoryKey, 'acknowledged'); }
      catch { /* Private browsing may disallow storage. */ }
    }
    setModalOpen(false);
  };

  const active = data?.mode && data.mode !== 'NORMAL';
  const notices = data?.notices || [];
  const visible = Boolean(data && (active || notices.length > 0));
  const headline = data ? maintenanceSummary(data) : '';

  return <>
    {visible && data ? <div className="clear-service-status d-print-none" role="region"
      aria-label="CLEAR service status">
      <div className="clear-service-status-inner">
        <span className={'clear-service-status-dot ' + (active ? 'is-restricted' : 'is-scheduled')}
          aria-hidden="true" />
        <span className="clear-service-status-label">{active ? 'Service advisory' : 'Scheduled notice'}</span>
        <span className="clear-service-status-text" title={headline}>{headline}</span>
        {active && data.effectiveUntil ? <span className="clear-service-status-time">
          Until {pht(data.effectiveUntil)}
        </span> : null}
        <button type="button" className="clear-service-status-action"
          onClick={() => setModalOpen(true)} aria-haspopup="dialog">
          View details
        </button>
      </div>
    </div> : null}

    <dialog ref={dialogRef} className="clear-service-dialog d-print-none"
      aria-labelledby="clear-service-dialog-heading"
      aria-describedby="clear-service-dialog-intro"
      onCancel={event => { event.preventDefault(); acknowledge(); }}
      onClose={() => setModalOpen(false)}>
      {data ? <div className="clear-service-dialog-body">
        <div className="clear-service-dialog-eyebrow">
          <i className="bi bi-info-circle" aria-hidden="true" /> CLEAR SERVICE ADVISORY
        </div>
        <h2 id="clear-service-dialog-heading">
          {data.mode === 'FULL' ? 'Maintenance in progress' :
            data.mode === 'READ_ONLY' ? 'CLEAR is in read-only mode' : 'Scheduled maintenance notice'}
        </h2>
        <p id="clear-service-dialog-intro" className="clear-service-dialog-intro">
          {data.mode === 'READ_ONLY'
            ? 'You may continue to view permitted records. Changes and financial transactions are temporarily unavailable.'
            : data.mode === 'FULL'
              ? 'Services are temporarily unavailable while maintenance is completed.'
              : 'Please review this service announcement before proceeding.'}
        </p>
        {active ? <section className="clear-service-dialog-policy" aria-label="Current maintenance restrictions">
          {data.reason ? <p>{data.reason}</p> : null}
          {data.effectiveUntil ? <p className="clear-service-dialog-timing">
            Expected restoration by {pht(data.effectiveUntil)}
          </p> : null}
        </section> : null}
        {notices.slice(0, 3).map(n => <section key={n.id + ':' + n.revision}
          className="clear-service-dialog-notice" aria-label="Scheduled announcement">
          <div className="clear-service-dialog-notice-label">
            {n.state === 'ACTIVE' ? 'IN PROGRESS' : 'UPCOMING'}
          </div>
          <h3>{n.title}</h3>
          <p>{n.message}</p>
          <div className="clear-service-dialog-timing">
            {pht(n.startsAt)} – {pht(n.endsAt)}
          </div>
        </section>)}
        {notices.length > 3 ? <p className="clear-service-dialog-extra">
          And {notices.length - 3} more scheduled announcements.
        </p> : null}
        <div className="clear-service-dialog-footer">
          <span>Times shown in Philippine Time (PHT)</span>
          <button type="button" className="btn btn-info fw-semibold" onClick={acknowledge}
            autoFocus>Continue to CLEAR</button>
        </div>
      </div> : null}
    </dialog>
  </>;
}
