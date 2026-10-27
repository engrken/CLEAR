'use client';

import { useActionState } from 'react';
import {
  submitMaintenancePolicy, submitMaintenanceNotice, submitMaintenanceNoticeEdit,
  type MaintenanceFormState,
} from './actions';

type ScopeOption = { key: string; name: string };
const idle: MaintenanceFormState = { status: 'idle', message: '' };

function FormFeedback({ state }: { state: MaintenanceFormState }) {
  if (state.status === 'idle') return null;
  return <p role={state.status === 'error' ? 'alert' : 'status'}
    aria-live="polite"
    className={'small rounded border p-2 mb-0 ' +
      (state.status === 'error' ? 'border-danger text-warning' : 'border-success text-success')}>
    {state.message}
  </p>;
}

export function MaintenancePolicyForm({
  options, expiresDefault,
}: { options: ScopeOption[]; expiresDefault: string }) {
  const [state, action, pending] = useActionState(submitMaintenancePolicy, idle);
  return <form action={action} className="d-grid gap-3 mt-3">
    <label>Scope
      <select name="scope" className="form-select" required disabled={pending}>
        {options.map(o => <option key={o.key} value={o.key}>{o.name}</option>)}
      </select>
    </label>
    <label>Mode
      <select name="mode" className="form-select" defaultValue="NORMAL" disabled={pending}>
        <option value="NORMAL">NORMAL — maintenance OFF</option>
        <option value="READ_ONLY">READ_ONLY — disable mutations</option>
        <option value="FULL">FULL — maintenance landing only</option>
      </select>
    </label>
    <label>Public reason
      <textarea name="reason" className="form-control" maxLength={240}
        placeholder="At least 10 characters when READ_ONLY or FULL is selected. No private information."
        disabled={pending} />
      <span className="form-text text-secondary">Required for active maintenance modes; minimum 10 characters.</span>
    </label>
    <label>Expires (PHT, required for active modes)
      <input name="expiresAt" type="datetime-local" className="form-control"
        defaultValue={expiresDefault} disabled={pending} />
      <span className="form-text text-secondary">Must be more than 1 minute and at most 7 days in the future.</span>
    </label>
    <label>Confirmation
      <input name="confirmation" className="form-control" maxLength={80}
        placeholder="APPLY MAINTENANCE or RESTORE NORMAL" required autoComplete="off"
        disabled={pending} />
    </label>
    <FormFeedback state={state} />
    <button type="submit" className="btn btn-outline-warning" disabled={pending}>
      {pending ? 'Saving maintenance policy…' : 'Confirm policy update'}
    </button>
  </form>;
}

export function MaintenanceNoticeCreateForm({
  options, startsDefault, endsDefault,
}: { options: ScopeOption[]; startsDefault: string; endsDefault: string }) {
  const [state, action, pending] = useActionState(submitMaintenanceNotice, idle);
  return <form action={action} className="d-grid gap-3 mt-3">
    <label>Audience / scope
      <select name="scope" className="form-select" required disabled={pending}>
        {options.map(o => <option key={o.key} value={o.key}>{o.name}</option>)}
      </select>
    </label>
    <label>Title
      <input name="title" className="form-control" minLength={5} maxLength={140}
        placeholder="Scheduled CLEAR service maintenance" required disabled={pending} />
    </label>
    <label>Description
      <textarea name="message" className="form-control" minLength={10} maxLength={800}
        required disabled={pending}
        placeholder="At least 10 characters describing impact and expected restoration." />
    </label>
    <label>Starts (PHT)
      <input name="startsAt" type="datetime-local" className="form-control"
        defaultValue={startsDefault} required disabled={pending} />
    </label>
    <label>Ends (PHT)
      <input name="endsAt" type="datetime-local" className="form-control"
        defaultValue={endsDefault} required disabled={pending} />
    </label>
    <label>Publication
      <select name="state" className="form-select" disabled={pending}>
        <option value="DRAFT">DRAFT — invisible to public</option>
        <option value="SCHEDULED">SCHEDULED — publish notice only</option>
      </select>
    </label>
    <FormFeedback state={state} />
    <button type="submit" className="btn btn-outline-info" disabled={pending}>
      {pending ? 'Saving announcement…' : 'Create announcement'}
    </button>
  </form>;
}

export function MaintenanceNoticeEditForms({
  id, draft, startsDefault, endsDefault,
}: { id: string; draft: boolean; startsDefault: string; endsDefault: string }) {
  const [state, action, pending] = useActionState(submitMaintenanceNoticeEdit, idle);
  return <div className="d-grid gap-2">
    <div className="d-flex flex-wrap gap-2">
      {draft && <form action={action} className="d-flex gap-2 align-items-center">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="command" value="PUBLISH" />
        <input name="confirmation" className="form-control form-control-sm"
          placeholder="PUBLISH" required disabled={pending} />
        <button type="submit" className="btn btn-outline-info btn-sm" disabled={pending}>Publish</button>
      </form>}
      <form action={action} className="d-flex gap-2 flex-wrap align-items-center">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="command" value="RESCHEDULE" />
        <input type="datetime-local" name="startsAt" defaultValue={startsDefault}
          className="form-control form-control-sm" aria-label="New start time PHT" required disabled={pending} />
        <input type="datetime-local" name="endsAt" defaultValue={endsDefault}
          className="form-control form-control-sm" aria-label="New end time PHT" required disabled={pending} />
        <input name="confirmation" className="form-control form-control-sm"
          placeholder="RESCHEDULE" required disabled={pending} />
        <button type="submit" className="btn btn-outline-warning btn-sm" disabled={pending}>Reschedule</button>
      </form>
      <form action={action} className="d-flex gap-2 align-items-center">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="command" value="CANCEL" />
        <input name="confirmation" className="form-control form-control-sm"
          placeholder="CANCEL" required disabled={pending} />
        <button type="submit" className="btn btn-outline-danger btn-sm" disabled={pending}>Cancel</button>
      </form>
    </div>
    <FormFeedback state={state} />
  </div>;
}
