'use server';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/permissions';
import { revalidatePath } from 'next/cache';
import { validMode } from '@/lib/maintenance/rules';

class MaintenanceInputError extends Error {}

export type MaintenanceFormState = {
  status: 'idle' | 'success' | 'error';
  message: string;
};

const asFormState = async (run: () => Promise<unknown>, successMessage: string): Promise<MaintenanceFormState> => {
  try {
    await run();
    return { status: 'success', message: successMessage };
  } catch (error) {
    // Only known input / stale-edit failures are displayed to operators.
    // Unauthorized sessions, infrastructure outages and DB failures must not
    // be reclassified as benign user input problems or expose internal data.
    if (error instanceof MaintenanceInputError) {
      return { status: 'error', message: error.message };
    }
    throw error;
  }
};


function field(form: FormData, key: string, max: number): string {
  const value = form.get(key);
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length > max) throw new MaintenanceInputError('Invalid ' + key + '.');
  return text;
}
function manilaDate(value: string): Date {
  // Browser's datetime-local input is intentionally interpreted as PHT,
  // not Vercel UTC; no reliance on client clock for enforcement.
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(value)) throw new MaintenanceInputError('Specify a date and time in PHT.');
  const date = new Date(value + ':00+08:00');
  if (Number.isNaN(date.getTime()) || new Date(date.getTime() + 8 * 3600000).toISOString().slice(0, 16) !== value) {
    throw new MaintenanceInputError('Invalid date and time.');
  }
  return date;
}
async function resolveScope(form: FormData): Promise<string> {
  const raw = field(form, 'scope', 100).toLowerCase();
  if (raw === 'global') return 'GLOBAL';
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(raw)) throw new MaintenanceInputError('Invalid tenant scope.');
  const org = await prisma.organization.findUnique({ where: { subdomain: raw }, select: { id: true } });
  if (!org) throw new MaintenanceInputError('Tenant not found.');
  return 'tenant:' + raw;
}
function updatedPages() {
  revalidatePath('/dashboard/provisions/maintenance');
  revalidatePath('/dashboard');
  revalidatePath('/');
}
function auditPolicy(row: { mode: string; reason: string; expiresAt: Date | null; version: number } | null) {
  return row ? { mode: row.mode, reason: row.reason, expiresAt: row.expiresAt?.toISOString() ?? null,
    version: row.version } : null;
}

export async function setMaintenancePolicy(form: FormData) {
  const admin = await requireSuperAdmin(true);
  const actor = String(admin.email ?? '').trim().toLowerCase();
  const scopeKey = await resolveScope(form);
  const mode = field(form, 'mode', 20);
  if (!validMode(mode)) throw new MaintenanceInputError('Invalid maintenance mode.');
  const confirm = field(form, 'confirmation', 80);
  if (confirm !== (mode === 'NORMAL' ? 'RESTORE NORMAL' : 'APPLY MAINTENANCE')) {
    throw new MaintenanceInputError('Type the exact maintenance confirmation to proceed.');
  }
  const reason = field(form, 'reason', 240);
  if (mode !== 'NORMAL' && reason.length < 10) throw new MaintenanceInputError('A clear maintenance reason is required.');
  let expiresAt: Date | null = null;
  if (mode !== 'NORMAL') {
    const raw = field(form, 'expiresAt', 35);
    expiresAt = manilaDate(raw);
    const delta = expiresAt.getTime() - Date.now();
    if (delta <= 60000 || delta > 7 * 86400000) {
      throw new MaintenanceInputError('Maintenance must expire between 1 minute and 7 days from now.');
    }
  }
  await prisma.$transaction(async tx => {
    const before = await tx.maintenancePolicy.findUnique({ where: { scopeKey } });
    const after = await tx.maintenancePolicy.upsert({
      where: { scopeKey },
      create: { scopeKey, mode, reason: mode === 'NORMAL' ? '' : reason, expiresAt, updatedBy: actor },
      update: { mode, reason: mode === 'NORMAL' ? '' : reason, expiresAt, updatedBy: actor,
        version: { increment: 1 } },
    });
    await tx.maintenanceAudit.create({ data: {
      scopeKey, action: 'POLICY_CHANGE', actor,
      before: auditPolicy(before) ?? undefined,
      after: auditPolicy(after) ?? undefined,
    } });
  });
  updatedPages();
}

function noticeAudit(row: { title: string; message: string; mode: string; startsAt: Date; endsAt: Date;
  state: string; version: number }) {
  return { title: row.title, message: row.message, mode: row.mode, startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(), state: row.state, version: row.version };
}
export async function createMaintenanceNotice(form: FormData) {
  const admin = await requireSuperAdmin(true);
  const actor = String(admin.email ?? '').trim().toLowerCase();
  const scopeKey = await resolveScope(form);
  const title = field(form, 'title', 140);
  const message = field(form, 'message', 800);
  const start = manilaDate(field(form, 'startsAt', 35));
  const end = manilaDate(field(form, 'endsAt', 35));
  const state = field(form, 'state', 25) || 'SCHEDULED';
  const mode = field(form, 'mode', 20) || 'NORMAL';
  if (!validMode(mode)) throw new MaintenanceInputError('Invalid maintenance mode.');
  if (!['DRAFT', 'SCHEDULED'].includes(state)) throw new MaintenanceInputError('Invalid notice publication state.');
  if (title.length < 5 || message.length < 10) throw new MaintenanceInputError('Provide a title and a meaningful notice.');
  if (end <= start || end.getTime() - start.getTime() > 14 * 86400000) {
    throw new MaintenanceInputError('Invalid notice window: maximum 14 days.');
  }
  if (state === 'SCHEDULED' && end.getTime() <= Date.now()) {
    throw new MaintenanceInputError('Published notice must have a future end.');
  }
  if (mode !== 'NORMAL') {
    if (start.getTime() < Date.now() - 120000) {
      throw new MaintenanceInputError('Maintenance start must be current or in the future.');
    }
    if (end.getTime() - start.getTime() > 7 * 86400000) {
      throw new MaintenanceInputError('Maintenance windows must not exceed seven days.');
    }
    const confirmation = field(form, 'confirmation', 80);
    if (confirmation !== 'SCHEDULE MAINTENANCE') {
      throw new MaintenanceInputError('Type SCHEDULE MAINTENANCE to confirm the service restriction.');
    }
  }
  await prisma.$transaction(async tx => {
    const row = await tx.maintenanceNotice.create({ data: {
      scopeKey, title, message, mode, startsAt: start, endsAt: end, state,
      createdBy: actor, updatedBy: actor,
    } });
    await tx.maintenanceAudit.create({ data: {
      scopeKey, action: 'NOTICE_CREATE', actor, after: noticeAudit(row),
    } });
  });
  updatedPages();
}
export async function editMaintenanceNotice(form: FormData) {
  const admin = await requireSuperAdmin(true);
  const actor = String(admin.email ?? '').trim().toLowerCase();
  const id = field(form, 'id', 128);
  const command = field(form, 'command', 20);
  if (!['CANCEL', 'RESCHEDULE', 'PUBLISH', 'END_EARLY'].includes(command)) throw new MaintenanceInputError('Invalid notice action.');
  const confirmation = field(form, 'confirmation', 35);
  if (confirmation !== command) throw new MaintenanceInputError('Type the selected notice action to confirm.');
  await prisma.$transaction(async tx => {
    const before = await tx.maintenanceNotice.findUnique({ where: { id } });
    if (!before) throw new MaintenanceInputError('Maintenance notice was not found.');
    if (before.state === 'CANCELLED') throw new MaintenanceInputError('A cancelled notice cannot be republished.');
    let update: {
      state?: string; startsAt?: Date; endsAt?: Date;
      version: { increment: number }; updatedBy: string;
    } = { version: { increment: 1 }, updatedBy: actor };
    if (command === 'END_EARLY') {
      if (before.mode === 'NORMAL' || before.state !== 'SCHEDULED' ||
          before.startsAt.getTime() > Date.now() || before.endsAt.getTime() <= Date.now()) {
        throw new MaintenanceInputError('Only an active maintenance window can be ended early.');
      }
      update.state = 'CANCELLED'; // Existing end time remains immutable audit evidence.
    } else if (command === 'CANCEL') {
      if (before.mode !== 'NORMAL' && before.state === 'SCHEDULED' &&
          before.startsAt.getTime() <= Date.now() && before.endsAt.getTime() > Date.now()) {
        throw new MaintenanceInputError('Use END_EARLY for active maintenance.');
      }
      update.state = 'CANCELLED';
    } else if (command === 'PUBLISH') {
      if (before.endsAt.getTime() <= Date.now()) throw new MaintenanceInputError('Expired notice cannot be published.');
      update.state = 'SCHEDULED';
    } else {
      const startsAt = manilaDate(field(form, 'startsAt', 35));
      const endsAt = manilaDate(field(form, 'endsAt', 35));
      if (startsAt >= endsAt || endsAt.getTime() <= Date.now() ||
          endsAt.getTime() - startsAt.getTime() > (before.mode === 'NORMAL' ? 14 : 7) * 86400000 ||
          (before.mode !== 'NORMAL' && startsAt.getTime() < Date.now() - 120000)) {
        throw new MaintenanceInputError('Invalid rescheduled notice window.');
      }
      update = { ...update, startsAt, endsAt, state: 'SCHEDULED' };
    }
    // Compare version to protect against two administrators changing the same
    // notice concurrently; optimistic stale updates must fail, not overwrite.
    const count = await tx.maintenanceNotice.updateMany({
      where: { id, version: before.version }, data: update,
    });
    if (count.count !== 1) throw new MaintenanceInputError('Notice changed concurrently; reload the page.');
    const after = await tx.maintenanceNotice.findUniqueOrThrow({ where: { id } });
    await tx.maintenanceAudit.create({ data: {
      scopeKey: before.scopeKey, action: 'NOTICE_' + command, actor,
      before: noticeAudit(before), after: noticeAudit(after),
    } });
  });
  updatedPages();
}

/**
 * React useActionState adapters. Direct action exports remain for programmatic
 * security tests and continue to reject invalid/unauthorized requests.
 */
export async function submitMaintenancePolicy(
  _previous: MaintenanceFormState, form: FormData,
): Promise<MaintenanceFormState> {
  return asFormState(() => setMaintenancePolicy(form), 'Maintenance policy saved. Review the effective scope and audit record below.');
}

export async function submitMaintenanceNotice(
  _previous: MaintenanceFormState, form: FormData,
): Promise<MaintenanceFormState> {
  return asFormState(() => createMaintenanceNotice(form), 'Maintenance schedule / announcement saved. Restriction activates automatically at the specified PHT start time.');
}

export async function submitMaintenanceNoticeEdit(
  _previous: MaintenanceFormState, form: FormData,
): Promise<MaintenanceFormState> {
  return asFormState(() => editMaintenanceNotice(form), 'Notice updated and recorded in the maintenance audit.');
}
