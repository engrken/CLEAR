// /app/department/[department]/(protected)/setup/collections/page.tsx

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireDepartmentAccess, normalizeDepartmentSlug } from '@/lib/permissions';
import { logSystemAction } from '@/lib/logger';

export default async function CollectionSetupPage({
  params,
  searchParams,
}: {
  params: Promise<{ department: string }>;
  searchParams?: Promise<{ ay?: string; term?: string }>;
}) {
  const { department: rawDepartment } = await params;
  const department = normalizeDepartmentSlug(rawDepartment);
  const resolvedSearch = searchParams ? await searchParams : {};

  let organization;
  try {
    ({ org: organization } = await requireDepartmentAccess('tab-setup', department));
  } catch {
    redirect(`/department/${encodeURIComponent(department)}?forbidden=true`);
  }

  const ay = resolvedSearch.ay || organization.activeAy;
  const term = resolvedSearch.term || organization.activeTerm;

  const collectionItems = await prisma.collectionSetup.findMany({
    where: { organizationId: organization.id, academicYear: ay, term },
    orderBy: { category: 'asc' }
  });

  const funds = await prisma.fund.findMany({
    where: { organizationId: organization.id, academicYear: ay, term }
  });

  // Server Action to add a new collection item.
  // Server actions are public endpoints: re-check access on every call.
  async function addCollectionItem(formData: FormData) {
    'use server';
    const { user, org } = await requireDepartmentAccess('tab-setup', department);

    const category = String(formData.get('category') || '').trim();
    const name = String(formData.get('name') || '').trim();
    const targetFund = String(formData.get('targetFund') || '').trim();
    const amount = Number(formData.get('amount'));
    if (!name || !targetFund || !Number.isFinite(amount) || amount < 0) {
      throw new Error('Name, target fund and a valid non-negative amount are required.');
    }

    await prisma.collectionSetup.create({
      data: {
        organizationId: org.id,
        academicYear: ay,
        term: term,
        category,
        name,
        amount: Math.round(amount * 100) / 100,
        targetFund,
        isPackage: formData.get('isPackage') === 'on', // NEW: Capture the checkbox state
      }
    });
    await logSystemAction(org.id, user.fullName || user.email, 'CREATE_COLLECTION_SETUP', `Created collection setup item '${name}' (₱${amount.toFixed(2)} -> ${targetFund}).`);
    revalidatePath(`/department/${department}/setup/collections`);
    // Revalidate other modules so they immediately catch the new fee logic
    revalidatePath(`/department/${department}/collections`);
    revalidatePath(`/department/${department}/clearance`);
    revalidatePath(`/department/${department}/reports`);
  }

  // Server Action to delete a collection item. The bound id comes from the
  // client, so the delete is scoped to the caller's organization.
  async function deleteItem(id: string) {
    'use server';
    const { user, org } = await requireDepartmentAccess('tab-setup', department);
    const result = await prisma.collectionSetup.deleteMany({ where: { id: String(id), organizationId: org.id } });
    if (result.count === 0) throw new Error('Collection setup item not found.');
    await logSystemAction(org.id, user.fullName || user.email, 'DELETE_COLLECTION_SETUP', `Removed collection setup item ${id}.`);
    revalidatePath(`/department/${department}/setup/collections`);
    revalidatePath(`/department/${department}/collections`);
    revalidatePath(`/department/${department}/clearance`);
    revalidatePath(`/department/${department}/reports`);
  }

  return (
    <div className="mx-auto" style={{ maxWidth: '1150px', minWidth: 0 }}>
      {/* Header aligned with SetupClient style */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h5 className="text-accent m-0 fw-bold"><i className="bi bi-list-check me-2"></i>Setup Collection Fees</h5>
          <small className="text-secondary">Define categories and fees for {term} ({ay}).</small>
        </div>
      </div>
      
      <div className="card p-3 mb-4 border-secondary bg-card">
        <form action={addCollectionItem} className="row g-3">
          <div className="col-md-3">
            <label className="form-label text-secondary small fw-semibold">Category</label>
            <input type="text" name="category" className="form-control bg-dark text-white border-secondary" placeholder="e.g., Merchandise" required />
          </div>
          <div className="col-md-3">
            <label className="form-label text-secondary small fw-semibold">Item Name</label>
            <input type="text" name="name" className="form-control bg-dark text-white border-secondary" placeholder="e.g., Department Shirt" required />
          </div>
          <div className="col-md-2">
            <label className="form-label text-secondary small fw-semibold">Amount (₱)</label>
            <input type="number" step="0.01" min="0" name="amount" className="form-control bg-dark text-white border-secondary" required />
          </div>
          <div className="col-md-3">
            <label className="form-label text-secondary small fw-semibold">Target Fund</label>
            <select name="targetFund" className="form-select bg-dark text-white border-secondary" required>
              {funds.map(f => <option key={f.id} value={f.fundName}>{f.fundName}</option>)}
              {/* Fallback option in case no funds exist yet */}
              <option value="Others">Others</option>
              <option value="General Fund">General Fund</option>
            </select>
          </div>
          <div className="col-md-1 d-flex align-items-end">
            <button type="submit" className="btn btn-info fw-bold w-100"><i className="bi bi-plus-lg"></i></button>
          </div>

          {/* NEW: Mandatory Package Checkbox */}
          <div className="col-12 mt-3">
            <div className="form-check p-2 px-3 border border-secondary rounded bg-dark d-inline-block w-100">
              <input 
                type="checkbox" 
                name="isPackage" 
                className="form-check-input border-secondary" 
                id="isPackageCheck" 
                defaultChecked={true} 
                style={{ cursor: 'pointer' }}
              />
              <label className="form-check-label fw-bold text-white ms-2" htmlFor="isPackageCheck" style={{ cursor: 'pointer' }}>
                Include in Mandatory Package (Clearance Blocker)
              </label>
              <div className="text-secondary ms-2 mt-1" style={{ fontSize: '0.8rem' }}>
                Keep checked if this fee is required for student clearance. Uncheck for optional merchandise or standalone tickets.
              </div>
            </div>
          </div>
        </form>
      </div>

      <div className="card p-3 border-secondary bg-card">
        <div className="table-responsive">
          <table className="table table-hover align-middle table-sm border-secondary text-white mb-0" style={{ fontSize: '0.85rem' }}>
            <thead>
              <tr className="text-secondary border-bottom border-secondary">
                <th className="py-2">Category</th>
                <th className="py-2">Item Name</th>
                <th className="py-2 text-end">Amount</th>
                <th className="py-2">Target Fund</th>
                <th className="py-2 text-center">Type</th>
                <th className="py-2 text-center" style={{ width: '80px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {collectionItems.map(item => (
                <tr key={item.id}>
                  <td className="fw-semibold">{item.category}</td>
                  <td>{item.name}</td>
                  <td className="text-end text-success fw-bold">₱{item.amount.toFixed(2)}</td>
                  <td><span className="badge bg-dark border border-secondary text-secondary">{item.targetFund}</span></td>
                  
                  {/* NEW: Type Column Badge */}
                  <td className="text-center">
                    {item.isPackage !== false ? (
                      <span className="badge bg-success bg-opacity-25 text-success border border-success border-opacity-50">Package</span>
                    ) : (
                      <span className="badge bg-warning bg-opacity-25 text-warning border border-warning border-opacity-50">Standalone</span>
                    )}
                  </td>

                  <td className="text-center">
                    <form action={deleteItem.bind(null, item.id)}>
                      <button type="submit" className="btn btn-sm btn-outline-danger py-0 px-2" title="Delete Item">
                        <i className="bi bi-trash"></i>
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {collectionItems.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-secondary py-4 fst-italic">
                    No collection items setup for this term yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}