'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PRESENCE_TABS, normalizePresencePage } from '@/lib/collaboration-pages';

type Colleague = { id: string; name: string };
type TourStep = { title: string; detail: string; module?: string };
const MODULES: Array<{ tab: string; page: string; title: string; detail: string }> = [
  { tab: 'tab-overview', page: '', title: 'Your overview', detail: 'Review current-term financial totals and balances without altering records.' },
  { tab: 'tab-students', page: 'students', title: 'Student roster', detail: 'Review current-term enrollment before adding any obligation to a student.' },
  { tab: 'tab-clearance', page: 'clearance', title: 'Clearance status', detail: 'Check verified clearance only for people you are authorized to view.' },
  { tab: 'tab-payment', page: 'collections', title: 'Collections and receipts', detail: 'Check payables, fee setup and the amount carefully. A confirmation is required before recording a payment.' },
  { tab: 'tab-remittances', page: 'remittances', title: 'Remittance verification', detail: 'Review proof, amount and destination fund before accepting or rejecting a remittance.' },
  { tab: 'tab-advances', page: 'advances', title: 'Cash advances', detail: 'Check the requestor, fund, purpose, and unliquidated balance before proceeding.' },
  { tab: 'tab-audit', page: 'liquidations', title: 'Liquidation audit', detail: 'Match the approved advance with actual proof and receipts before finalizing an audit.' },
  { tab: 'tab-collectibles', page: 'collectibles', title: 'Outstanding dues', detail: 'Review authorized student dues and maintain the original financial audit trail.' },
  { tab: 'tab-reports', page: 'reports', title: 'Department reports', detail: 'Use read-only reports to reconcile financial activity by academic period.' },
  { tab: 'tab-users', page: 'users', title: 'User management', detail: 'Officer access must follow role, active account and tenant boundaries.' },
  { tab: 'tab-setup', page: 'setup', title: 'System setup', detail: 'Changes to fees or terms can affect financial integrity. Review the final confirmation carefully.' },
];
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((v) => v[0]?.toUpperCase() || '').join('') || '?';

export default function DepartmentPresenceAndTour({
  department, currentUser, ay, term, pathname,
}: {
  department: string;
  currentUser: { id?: string; role?: string; isSuperAdmin?: boolean; allowedTabs?: string[] };
  ay: string;
  term: string;
  pathname: string;
}) {
  const exempt = Boolean(currentUser.isSuperAdmin) || String(currentUser.role || '').toLowerCase() === 'superadmin';
  const routeRoot = '/department/' + encodeURIComponent(department);
  const module = pathname.startsWith(routeRoot)
    ? (pathname.slice(routeRoot.length).split('/').filter(Boolean)[0] || 'overview')
    : '';
  const page = normalizePresencePage(module);
  const [colleagues, setColleagues] = useState<Colleague[]>([]);
  const [total, setTotal] = useState(0);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [tourPending, setTourPending] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [tourError, setTourError] = useState('');
  const [finished, setFinished] = useState(false);
  const base = '/api/department/' + encodeURIComponent(department);
  const permitted = Array.isArray(currentUser.allowedTabs) ? currentUser.allowedTabs : [];
  const isAdmin = ['admin', 'administrator', 'master'].includes(String(currentUser.role || '').toLowerCase());
  const steps = useMemo<TourStep[]>(() => [
    { title: 'Welcome to CLEAR', detail: 'This guide covers only the modules available to your assigned role. Your actions remain subject to server-side permissions.' },
    ...MODULES.filter((m) => isAdmin || permitted.includes(m.tab)).map(({ page: route, title, detail }) => ({ module: route, title, detail })),
    { title: 'Before you commit', detail: 'Always review the affected student, amount, academic term and audit impact. Confirmations help avoid mistakes but never replace server validation.' },
    { title: 'Help and privacy', detail: 'Use the account menu for privacy information. Other officers appear only when they are actively viewing your same tenant, page and term.' },
  ], [isAdmin, permitted.join('|')]);

  useEffect(() => {
    if (exempt || !page || !PRESENCE_TABS[page]) return;
    let alive = true;
    const id = crypto.randomUUID();
    const pulse = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const res = await fetch(base + '/presence', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tabId: id, page, ay, term }),
          credentials: 'same-origin', cache: 'no-store',
        });
        if (!res.ok) throw new Error('Not available');
        const result = await res.json();
        if (alive) {
          setColleagues(Array.isArray(result.colleagues) ? result.colleagues : []);
          setTotal(Number(result.count) || 0);
        }
      } catch {
        if (alive) { setColleagues([]); setTotal(0); }
      }
    };
    const leave = () => {
      void fetch(base + '/presence', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tabId: id }), credentials: 'same-origin', keepalive: true,
      }).catch(() => {});
      if (alive) { setColleagues([]); setTotal(0); }
    };
    void pulse();
    const interval = window.setInterval(() => void pulse(), 30_000);
    const visibility = () => document.visibilityState === 'visible' ? void pulse() : leave();
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', leave);
    return () => {
      alive = false; clearInterval(interval);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', leave);
      leave();
    };
  }, [department, base, page, ay, term, exempt]);

  useEffect(() => {
    if (exempt) return;
    let alive = true;
    void fetch(base + '/onboarding', { credentials: 'same-origin', cache: 'no-store' })
      .then(async res => {
        if (!res.ok) throw new Error('Unavailable');
        const data = await res.json();
        if (alive && !data.exempt && !data.completed) setShowTour(true);
      })
      .catch(() => { /* Onboarding must never interrupt unauthorized or offline sessions. */ });
    return () => { alive = false; };
  }, [base, exempt, currentUser.id]);

  // The existing mandatory privacy notice opens first. The walkthrough waits
  // until it has been acknowledged; avoid two simultaneous blocking dialogs.
  useEffect(() => {
    if (!showTour || exempt || finished) return;
    const checkPrivacy = () => {
      if (localStorage.getItem('clear_privacy_accepted') === 'true') setTourOpen(true);
    };
    checkPrivacy();
    const id = window.setInterval(checkPrivacy, 2000);
    return () => clearInterval(id);
  }, [showTour, exempt, finished]);

  const endTour = useCallback(async () => {
    if (tourPending) return;
    setTourPending(true); setTourError('');
    try {
      const response = await fetch(base + '/onboarding', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      if (!response.ok) throw new Error('Unable to save your walkthrough progress. Please retry.');
      setFinished(true); setTourOpen(false); setShowTour(false);
    } catch (error) {
      setTourError(error instanceof Error ? error.message : 'Unable to complete walkthrough.');
    } finally { setTourPending(false); }
  }, [tourPending, base]);

  if (exempt) return null;
  return (
    <div className="d-flex align-items-center gap-2">
      {page ? (
        <div className="d-flex align-items-center gap-1" aria-label={`${total} colleagues viewing this page`}>
          {colleagues.slice(0, 5).map((person) => (
            <span key={person.id} title={person.name} aria-label={person.name}
              className="rounded-circle bg-info text-dark border border-light d-inline-flex align-items-center justify-content-center fw-bold"
              style={{ width: 31, height: 31, fontSize: '0.69rem', cursor: 'help' }}>
              {initials(person.name)}
            </span>
          ))}
          {total > 5 ? <span className="small text-secondary" title={`${total - 5} additional colleagues`}>+{total - 5}</span> : null}
          {total > 0 ? <span className="small text-secondary d-none d-md-inline ms-1">on this page</span> : null}
        </div>
      ) : null}
      <button className="btn btn-outline-secondary btn-sm" type="button"
        title="Replay your role-specific first-time walkthrough" onClick={() => {
          setTourStep(0); setTourError(''); setTourOpen(true);
        }}>
        <i className="bi bi-question-circle me-1" aria-hidden="true" /> Tour
      </button>
      {tourOpen && <div className="modal fade show d-block" role="dialog" aria-modal="true"
        aria-labelledby="clear-onboarding-title"
        style={{ background: 'rgba(0,0,0,0.76)', zIndex: 1090 }}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content border-info shadow-lg bg-card text-body">
            <div className="modal-header">
              <h2 id="clear-onboarding-title" className="modal-title h5 fw-bold">{steps[tourStep]?.title}</h2>
            </div>
            <div className="modal-body">
              <p>{steps[tourStep]?.detail}</p>
              {steps[tourStep]?.module !== undefined ? (
                <Link className="btn btn-outline-info btn-sm" href={`/department/${encodeURIComponent(department)}${steps[tourStep]?.module ? '/' + steps[tourStep].module : ''}?ay=${encodeURIComponent(ay)}&term=${encodeURIComponent(term)}`}
                  onClick={() => setTourOpen(false)}>Explore module (closes tour)</Link>
              ) : null}
              <p className="small text-secondary mt-3 mb-0">Step {tourStep + 1} of {steps.length}. You can replay this guide from the header.</p>
              {tourError && <p className="text-danger small" role="alert">{tourError}</p>}
            </div>
            <div className="modal-footer d-flex justify-content-between">
              <button type="button" className="btn btn-outline-secondary btn-sm" disabled={tourPending} onClick={() => void endTour()}>Skip guide</button>
              <div className="d-flex gap-2">
                {tourStep > 0 && <button type="button" className="btn btn-outline-secondary btn-sm"
                  onClick={() => setTourStep(s => s - 1)}>Back</button>}
                <button type="button" className="btn btn-info btn-sm fw-bold" disabled={tourPending}
                  onClick={() => tourStep === steps.length - 1 ? void endTour() : setTourStep(s => s + 1)}>
                  {tourStep === steps.length - 1 ? 'Finish' : 'Next'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>}
    </div>
  );
}
