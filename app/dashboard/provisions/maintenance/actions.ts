'use server';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/permissions';
import { revalidatePath } from 'next/cache';
import { validMode } from '@/lib/maintenance/rules';

function field(form: FormData, key: string, max: number): string {
  const value = form.get(key);
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length > max) throw new Error('Invalid ' + key + '.');
  return text;
}
function manilaDate(value: string): Date {
  // Browser's datetime-local input is intentionally interpreted as PHT,
  // not Vercel UTC; no reliance on client clock for enforcement.
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(value)) throw new Error('Specify a date and time in PHT.');
  const date = new Date(value + ':00+08:00');
  if (Number.isNaN(date.getTime())) throw new Error('Invalid date and time.');
  return date;
}
async function resolveScope(form: FormData): Promise<string> {
  const raw = field(form, 'scope', 100).toLowerCase();
  if (raw === 'global') return 'GLOBAL';
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(raw)) throw new Error('Invalid tenant scope.');
  const org = await prisma.organization.findUnique({ where: { subdomain: raw }, select: { id: true } });
  if (!org) throw new Error('Tenant not found.');
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
  if (!validMode(mode)) throw new Error('Invalid maintenance mode.');
  const confirm = field(form, 'confirmation', 80);
  if (confirm !== (mode === 'NORMAL' ? 'RESTORE NORMAL' : 'APPLY MAINTENANCE')) {
    throw new Error('Type the exact maintenance confirmation to proceed.');
  }
  const reason = field(form, 'reason', 240);
  if (mode !== 'NORMAL' && reason.length < 10) throw new Error('A clear maintenance reason is required.');
  let expiresAt: Date | null = null;
  if (mode !== 'NORMAL') {
    const raw = field(form, 'expiresAt', 35);
    expiresAt = manilaDate(raw);
    const delta = expiresAt.getTime() - Date.now();
    if (delta <= 60000 || delta > 7 * 86400000) {
      throw new Error('Maintenance must expire between 1 minute and 7 days from now.');
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

function noticeAudit(row: { title: string; message: string; startsAt: Date; endsAt: Date;
  state: string; version: number }) {
  return { title: row.title, message: row.message, startsAt: row.startsAt.toISOString(),
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
  const state = field(form, 'state', 25);
  if (!['DRAFT', 'SCHEDULED'].includes(state)) throw new Error('Invalid notice publication state.');
  if (title.length < 5 || message.length < 10) throw new Error('Provide a title and a meaningful notice.');
  if (end <= start || end.getTime() - start.getTime() > 14 * 86400000) {
    throw new Error('Invalid notice window: maximum 14 days.');
  }
  if (state === 'SCHEDULED' && end.getTime() <= Date.now()) {
    throw new Error('Published notice must have a future end.');
  }
  await prisma.$transaction(async tx => {
    const row = await tx.maintenanceNotice.create({ data: {
      scopeKey, title, message, startsAt: start, endsAt: end, state,
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
  if (!['CANCEL', 'RESCHEDULE', 'PUBLISH'].includes(command)) throw new Error('Invalid notice action.');
  const confirmation = field(form, 'confirmation', 35);
  if (confirmation !== command) throw new Error('Type the selected notice action to confirm.');
  await prisma.$transaction(async tx => {
    const before = await tx.maintenanceNotice.findUnique({ where: { id } });
    if (!before) throw new Error('Maintenance notice was not found.');
    if (before.state === 'CANCELLED') throw new Error('A cancelled notice cannot be republished.');
    let update: {
      state?: string; startsAt?: Date; endsAt?: Date;
      version: { increment: number }; updatedBy: string;
    } = { version: { increment: 1 }, updatedBy: actor };
    if (command === 'CANCEL') update.state = 'CANCELLED';
    else if (command === 'PUBLISH') {
      if (before.endsAt.getTime() <= Date.now()) throw new Error('Expired notice cannot be published.');
      update.state = 'SCHEDULED';
    } else {
      const startsAt = manilaDate(field(form, 'startsAt', 35));
      const endsAt = manilaDate(field(form, 'endsAt', 35));
      if (startsAt >= endsAt || endsAt.getTime() <= Date.now() ||
          endsAt.getTime() - startsAt.getTime() > 14 * 86400000) {
        throw new Error('Invalid rescheduled notice window.');
      }
      update = { ...update, startsAt, endsAt, state: 'SCHEDULED' };
    }
    // Compare version to protect against two administrators changing the same
    // notice concurrently; optimistic stale updates must fail, not overwrite.
    const count = await tx.maintenanceNotice.updateMany({
      where: { id, version: before.version }, data: update,
    });
    if (count.count !== 1) throw new Error('Notice changed concurrently; reload the page.');
    const after = await tx.maintenanceNotice.findUniqueOrThrow({ where: { id } });
    await tx.maintenanceAudit.create({ data: {
      scopeKey: before.scopeKey, action: 'NOTICE_' + command, actor,
      before: noticeAudit(before), after: noticeAudit(after),
    } });
  });
  updatedPages();
}
