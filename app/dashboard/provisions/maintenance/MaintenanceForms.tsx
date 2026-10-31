'use client';

import { useActionState, useState } from 'react';
import {
  submitMaintenancePolicy, submitMaintenanceNotice, submitMaintenanceNoticeEdit,
  type MaintenanceFormState,
} from './actions';

type ScopeOption = { key: string; name: string };
const idle: MaintenanceFormState = { status: 'idle', message: '' };

function FormFeedback({ state }: { state: MaintenanceFormState }) {
  if (state.status === 'idle') return null;
  return <p role={state.status === 'error' ? 'alert' : 'status'} aria-live="polite"
    className={'small rounded border p-2 mb-0 ' +
      (state.status === 'error' ? 'border-danger text-warning' : 'border-success text-success')}>
    {state.message}
  </p>;
}

/** A single form schedules both public notices and (optionally) server-enforced maintenance. */
export function MaintenanceNoticeCreateForm({
  options, startsDefault, endsDefault,
}: { options: ScopeOption[]; startsDefault: string; endsDefault: string }) {
  const [state, action, pending] = useActionState(submitMaintenanceNotice, idle);
  const [mode, setMode] = useState('FULL');
  return <form action={action} className="d-grid gap-3 mt-3">
    <label>Apply to
      <select name="scope" className="form-select" required disabled={pending}>
        {options.map(option => <option key={option.key} value={option.key}>{option.name}</option>)}
      </select>
    </label>
    <label>Service status during this window
      <select name="mode" className="form-select" value={mode}
        onChange={event => setMode(event.target.value)} disabled={pending}>
        <option value="FULL">Full maintenance — show maintenance landing page</option>
        <option value="READ_ONLY">Read-only maintenance — temporarily block updates</option>
        <option value="NORMAL">Announcement only — no service interruption</option>
      </select>
    </label>
    <label>Announcement title
      <input name="title" className="form-control" minLength={5} maxLength={140}
        placeholder="Scheduled CLEAR maintenance" required disabled={pending} />
    </label>
    <label>Announcement notice
      <textarea name="message" className="form-control" minLength={10} maxLength={800}
        required disabled={pending} placeholder="Explain the affected features and expected service restoration. Do not include private data." />
    </label>
    <div className="row g-3">
      <label className="col-md-6">Start time (Philippine time)
        <input name="startsAt" type="datetime-local" className="form-control"
          defaultValue={startsDefault} required disabled={pending} />
      </label>
      <label className="col-md-6">End time (Philippine time)
        <input name="endsAt" type="datetime-local" className="form-control"
          defaultValue={endsDefault} required disabled={pending} />
      </label>
    </div>
    <input type="hidden" name="state" value="SCHEDULED" />
    {mode !== 'NORMAL' ? <label>Confirmation
      <input name="confirmation" className="form-control" autoComplete="off"
        maxLength={80} placeholder="SCHEDULE MAINTENANCE" required disabled={pending} />
      <span className="form-text text-secondary">Type SCHEDULE MAINTENANCE to confirm the scheduled restriction.</span>
    </label> : <p className="small text-info mb-0">Announcement only: all normal transactions remain available.</p>}
    <p className="small text-secondary mb-0">The announcement is visible before the start time.
      Maintenance activates automatically at Start and expires at End, based on the server clock.
      No background scheduler or browser session is required. Scheduled maintenance is limited to seven days.</p>
    <FormFeedback state={state} />
    <button type="submit" className="btn btn-warning fw-semibold" disabled={pending}>
      {pending ? 'Saving schedule…' : mode === 'NORMAL' ? 'Publish announcement' : 'Schedule maintenance and announcement'}
    </button>
  </form>;
}

export function MaintenanceNoticeEditForms({
  id, draft, active, mode, startsDefault, endsDefault,
}: { id: string; draft: boolean; active: boolean; mode: string;
  startsDefault: string; endsDefault: string }) {
  const [state, action, pending] = useActionState(submitMaintenanceNoticeEdit, idle);
  return <div className="d-grid gap-2">
    <div className="d-flex flex-wrap gap-2 align-items-center">
      {draft ? <form action={action} className="d-flex gap-2 align-items-center">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="command" value="PUBLISH" />
        <input name="confirmation" className="form-control form-control-sm"
          placeholder="PUBLISH" required disabled={pending} />
        <button type="submit" className="btn btn-outline-info btn-sm" disabled={pending}>Publish</button>
      </form> : null}
      <form action={action} className="d-flex gap-2 flex-wrap align-items-center">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="command" value="RESCHEDULE" />
        <input type="datetime-local" name="startsAt" defaultValue={startsDefault}
          className="form-control form-control-sm" aria-label="Revised start time PHT" required disabled={pending} />
        <input type="datetime-local" name="endsAt" defaultValue={endsDefault}
          className="form-control form-control-sm" aria-label="Revised end time PHT" required disabled={pending} />
        <input name="confirmation" className="form-control form-control-sm"
          placeholder="RESCHEDULE" required disabled={pending} />
        <button type="submit" className="btn btn-outline-warning btn-sm" disabled={pending}>Reschedule</button>
      </form>
      {active && mode !== 'NORMAL' ? <form action={action} className="d-flex gap-2 align-items-center">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="command" value="END_EARLY" />
        <input name="confirmation" className="form-control form-control-sm"
          aria-label="Confirm early end" placeholder="END_EARLY" required disabled={pending} />
        <button type="submit" className="btn btn-danger btn-sm" disabled={pending}>
          End maintenance early
        </button>
      </form> : <form action={action} className="d-flex gap-2 align-items-center">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="command" value="CANCEL" />
        <input name="confirmation" className="form-control form-control-sm"
          placeholder="CANCEL" required disabled={pending} />
        <button type="submit" className="btn btn-outline-danger btn-sm" disabled={pending}>Cancel</button>
      </form>}
    </div>
    {active && mode !== 'NORMAL' ?
      <p className="small text-warning mb-0">To restore service before its scheduled end,
        type END_EARLY and confirm. This is logged and does not erase the original schedule.</p> : null}
    <FormFeedback state={state} />
  </div>;
}

/** Preserves safe recovery from an older manually-applied policy. */
export function LegacyMaintenanceRestoreForm({ scopeKey }: { scopeKey: string }) {
  const [state, action, pending] = useActionState(submitMaintenancePolicy, idle);
  return <form action={action} className="d-flex flex-wrap align-items-center gap-2 mt-2">
    <input type="hidden" name="scope" value={scopeKey === 'GLOBAL' ? 'global' : scopeKey.slice('tenant:'.length)} />
    <input type="hidden" name="mode" value="NORMAL" />
    <input name="confirmation" className="form-control form-control-sm"
      style={{ maxWidth: 225 }} autoComplete="off" placeholder="RESTORE NORMAL"
      required disabled={pending} aria-label="Confirm manual override restore" />
    <button className="btn btn-outline-warning btn-sm" disabled={pending}>
      Restore manual policy
    </button>
    <FormFeedback state={state} />
  </form>;
}
