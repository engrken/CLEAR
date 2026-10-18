import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireTabAccess } from '@/lib/permissions';
import { getPeriodLedger } from '../../realign/ledger';
import { revalidatePath } from 'next/cache';
import type { Metadata } from 'next';
import { assertAcademicPeriod } from '@/lib/academic-period-guard';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Collection Fee Setup | CLEAR System' };

const normalize = (value: unknown) => String(value ?? '').trim();

type PeriodKey = { organizationId: string; academicYear: string; term: string };
type FeeKey = { category: string; name: string; isPackage: boolean };

function amountInPesos(value: FormDataEntryValue | null): number {
  const raw = normalize(value);
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) {
    throw new Error('Enter a valid fee amount with up to two decimal places.');
  }
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) {
    throw new Error('The fee amount must be greater than zero and within the allowed limit.');
  }
  return Math.round(amount * 100) / 100;
}

function refresh(department: string) {
  const root = `/department/${department}`;
  for (const suffix of [
    '/setup/collections', '/collections', '/clearance', '/reports', '/summary', '/realign', ''
  ]) {
    revalidatePath(root + suffix);
  }
}

/**
 * Posting transactions does NOT close a term. Only an actual rollover does.
 * Check on the server for every write: browser-side disabled buttons are not security controls.
 */
async function assertNotRolledOver(
  db: Prisma.TransactionClient,
  organizationId: string,
  ay: string,
  term: string
) {
  await assertAcademicPeriod(db, organizationId, ay, term);
  const ledger = await getPeriodLedger(db, organizationId, ay, term);
  if (ledger.activeRollover) {
    throw new Error(
      'Fee setup for this term is closed because its balance was rolled over. ' +
      'Reverse the rollover before changing the fee configuration.'
    );
  }
}

/**
 * Existing paid items have no FK to CollectionSetup in the current Prisma schema.
 * Preserve records conservatively using their stored category/description and the period.
 * A mandatory package becomes immutable once fee activity begins because changing it
 * would recalculate package obligations and clearance for existing students.
 */
async function getDeletionBlockReason(
  db: Prisma.TransactionClient,
  period: PeriodKey,
  fee: FeeKey,
  hasPeriodFeeActivity?: boolean
): Promise<string | null> {
  let anyActivity = hasPeriodFeeActivity;
  if (fee.isPackage && anyActivity === undefined) {
    const [collections, online, collectibles] = await Promise.all([
      db.collection.count({ where: period }),
      db.onlineRemittance.count({ where: period }),
      db.collectible.count({ where: period }),
    ]);
    anyActivity = collections + online + collectibles > 0;
  }
  if (fee.isPackage && anyActivity) {
    return 'Mandatory package fees cannot be deleted after financial activity has been recorded for this term. ' +
      'Existing student balances and clearance depend on the configured package.';
  }

  // Protect previously referenced standalone fees, including voided or rejected records:
  // those records still form part of the financial/audit history.
  const matchesDescription = {
    contains: fee.name,
    mode: 'insensitive' as const,
  };
  const matchesCategory = {
    equals: fee.category,
    mode: 'insensitive' as const,
  };
  const [paidReceipts, submittedRemittances, categoryCollectibles] = await Promise.all([
    db.collection.count({
      where: { ...period, category: matchesCategory, itemDescription: matchesDescription },
    }),
    db.onlineRemittance.count({
      where: { ...period, category: matchesCategory, itemDescription: matchesDescription },
    }),
    db.collectible.count({
      where: { ...period, category: matchesCategory },
    }),
  ]);
  if (paidReceipts > 0 || submittedRemittances > 0 || categoryCollectibles > 0) {
    return 'This fee has related receipts, remittances, or collectibles and cannot be deleted. ' +
      'Keep the original fee for audit and clearance consistency.';
  }
  return null;
}

export default async function CollectionSetupPage({ params, searchParams }: {
  params: Promise<{ department: string }>;
  searchParams?: Promise<{ ay?: string; term?: string }>;
}) {
  const { department } = await params;
  let slug: string;
  try {
    slug = decodeURIComponent(department).trim().toLowerCase();
  } catch {
    return <div className="alert alert-danger">Invalid department identifier.</div>;
  }

  await requireTabAccess('tab-setup', slug);
  const organization = await prisma.organization.findUnique({
    where: { subdomain: slug },
    select: { id: true, activeAy: true, activeTerm: true },
  });
  if (!organization) return <div className="alert alert-danger">Department not found.</div>;

  const selected = searchParams ? await searchParams : {};
  const ay = normalize(selected.ay) || organization.activeAy;
  const term = normalize(selected.term) || organization.activeTerm;
  const orgId = organization.id;
  const period: PeriodKey = { organizationId: orgId, academicYear: ay, term };

  async function addCollectionItem(formData: FormData) {
    'use server';
    const officer = await requireTabAccess('tab-setup', slug);
    const category = normalize(formData.get('category'));
    const name = normalize(formData.get('name'));
    const targetFund = normalize(formData.get('targetFund'));
    const amount = amountInPesos(formData.get('amount'));
    const isPackage = formData.get('isPackage') === 'on';

    if (!category || !name || category.length > 120 || name.length > 180) {
      throw new Error('Provide a category and item name within the allowed lengths.');
    }
    if (!targetFund) throw new Error('Choose an existing destination fund.');

    await prisma.$transaction(async (tx) => {
      await assertNotRolledOver(tx, orgId, ay, term);

      const destination = await tx.fund.findFirst({
        where: { ...period, fundName: targetFund },
        select: { id: true },
      });
      if (!destination) {
        throw new Error('The selected destination fund does not exist for this term. Configure its funds first.');
      }

      const duplicate = await tx.collectionSetup.findFirst({
        where: {
          ...period,
          category: { equals: category, mode: 'insensitive' },
          name: { equals: name, mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (duplicate) throw new Error('This fee is already configured for the selected term and category.');

      await tx.collectionSetup.create({
        data: { ...period, category, name, targetFund, amount, isPackage },
      });
      await tx.systemLog.create({
        data: {
          organizationId: orgId,
          user: officer.fullName || officer.email || 'Authorized Setup Officer',
          action: 'COLLECTION_FEE_CREATED',
          details: `${category} / ${name}: ₱${amount.toFixed(2)} (${isPackage ? 'Mandatory' : 'Standalone'}) ` +
            `to ${targetFund} for ${term} (${ay}).`,
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    refresh(slug);
  }

  async function deleteItem(id: string) {
    'use server';
    const officer = await requireTabAccess('tab-setup', slug);
    await prisma.$transaction(async (tx) => {
      await assertNotRolledOver(tx, orgId, ay, term);
      const item = await tx.collectionSetup.findFirst({
        where: { id, ...period },
      });
      if (!item) throw new Error('Fee not found in this department and term.');

      const reason = await getDeletionBlockReason(tx, period, item);
      if (reason) throw new Error(reason);

      await tx.collectionSetup.delete({ where: { id: item.id } });
      await tx.systemLog.create({
        data: {
          organizationId: orgId,
          user: officer.fullName || officer.email || 'Authorized Setup Officer',
          action: 'COLLECTION_FEE_DELETED',
          details: `Removed unused fee ${item.category} / ${item.name}: ₱${item.amount.toFixed(2)} ` +
            `from ${term} (${ay}).`,
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    refresh(slug);
  }

  const [fees, funds, ledger, financialCounts] = await Promise.all([
    prisma.collectionSetup.findMany({
      where: period,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    }),
    prisma.fund.findMany({
      where: period,
      orderBy: { fundName: 'asc' },
    }),
    getPeriodLedger(prisma, orgId, ay, term),
    Promise.all([
      prisma.collection.count({ where: period }),
      prisma.onlineRemittance.count({ where: period }),
      prisma.collectible.count({ where: period }),
    ]),
  ]);

  const rolledOver = Boolean(ledger.activeRollover);
  const hasFeeActivity = financialCounts.some(count => count > 0);

  // Used/paid standalone fees are disabled in the UI as well as on the server.
  // The transaction-time check in deleteItem remains authoritative.
  const deletionReasons = await Promise.all(
    fees.map(async (fee) =>
      rolledOver
        ? 'This term has already been rolled over.'
        : getDeletionBlockReason(prisma, period, fee, hasFeeActivity)
    )
  );

  return (
    <div className="mx-auto" style={{ maxWidth: 1150 }}>
      <h5 className="fw-bold text-accent">
        <i className="bi bi-list-check me-2" />Setup Collection Fees
      </h5>
      <p className="small text-secondary">
        Configure mandatory package and standalone fees for {term} ({ay}).
      </p>

      {rolledOver ? (
        <div className="alert alert-warning small" role="alert">
          <strong>Term closed by rollover.</strong> Fee configuration is locked because this period's balance
          has already been carried forward. Reverse the rollover before changing fees.
        </div>
      ) : hasFeeActivity ? (
        <div className="alert alert-info small" role="status">
          <strong>This term is still open for new fees.</strong> Financial records already exist, but you can
          add new fee items. Adding a mandatory package fee can create new clearance requirements for
          students who have already made payments. Previously used fees are protected from deletion.
        </div>
      ) : null}

      <div className="card p-3 mb-4 border-secondary bg-body">
        <form action={addCollectionItem} className="row g-3">
          <div className="col-md-3">
            <label className="form-label" htmlFor="fee-category">Category</label>
            <input id="fee-category" name="category" className="form-control" maxLength={120}
              placeholder="e.g. Merchandise" required disabled={rolledOver} />
          </div>
          <div className="col-md-3">
            <label className="form-label" htmlFor="fee-item">Item Name</label>
            <input id="fee-item" name="name" className="form-control" maxLength={180}
              placeholder="e.g. Orientation" required disabled={rolledOver} />
          </div>
          <div className="col-md-2">
            <label className="form-label" htmlFor="fee-amount">Amount (₱)</label>
            <input id="fee-amount" type="number" name="amount" min="0.01" step="0.01"
              className="form-control" required disabled={rolledOver} />
          </div>
          <div className="col-md-3">
            <label className="form-label" htmlFor="fee-fund">Destination Fund</label>
            <select id="fee-fund" name="targetFund" className="form-select" required
              disabled={rolledOver || funds.length === 0}>
              {funds.map(fund =>
                <option key={fund.id} value={fund.fundName}>{fund.fundName}</option>
              )}
            </select>
          </div>
          <div className="col-md-1 d-flex align-items-end">
            <button type="submit" className="btn btn-info w-100"
              disabled={rolledOver || funds.length === 0} title="Add collection fee">
              <i className="bi bi-plus-lg" />
            </button>
          </div>
          <div className="col-12">
            <label className="form-check-label">
              <input type="checkbox" name="isPackage" defaultChecked={!hasFeeActivity}
                className="form-check-input me-2" disabled={rolledOver} />
              Include in mandatory package (clearance requirement)
            </label>
            {hasFeeActivity && !rolledOver && (
              <div className="form-text text-warning">
                Defaulted to standalone because this term already has financial records. Select mandatory
                only if you intend to update student clearance obligations for the current term.
              </div>
            )}
          </div>
        </form>
        {funds.length === 0 && (
          <p className="small text-warning mt-2 mb-0">
            Create this term's funds in Organization Setup before adding a fee.
          </p>
        )}
      </div>

      <div className="card p-3 border-secondary bg-body">
        <div className="table-responsive">
          <table className="table table-hover align-middle table-sm">
            <thead>
              <tr>
                <th>Category</th><th>Fee</th><th className="text-end">Amount</th>
                <th>Fund</th><th>Type</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {fees.map((fee, index) => {
                const reason = deletionReasons[index];
                return (
                  <tr key={fee.id}>
                    <td>{fee.category}</td>
                    <td>{fee.name}</td>
                    <td className="text-end">₱{fee.amount.toFixed(2)}</td>
                    <td>{fee.targetFund}</td>
                    <td>{fee.isPackage ? 'Mandatory Package' : 'Standalone'}</td>
                    <td>
                      <form action={deleteItem.bind(null, fee.id)}>
                        <button type="submit" className="btn btn-sm btn-outline-danger"
                          disabled={Boolean(reason)}
                          title={reason || 'Delete unused collection fee'}
                          aria-label={`Delete ${fee.name}`}>
                          <i className="bi bi-trash" />
                        </button>
                      </form>
                      {reason && <span className="text-secondary small ms-2" title={reason}>Protected</span>}
                    </td>
                  </tr>
                );
              })}
              {fees.length === 0 && (
                <tr><td colSpan={6} className="text-center text-secondary py-4">No fees configured.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
