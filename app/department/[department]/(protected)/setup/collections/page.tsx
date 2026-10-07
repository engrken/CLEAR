import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { Metadata } from "next";
import { saveCollectionSetupItem, deleteCollectionSetupItem } from "./actions";

export const metadata: Metadata = {
  title: "Setup Collection Items & Packages",
};

export default async function SetupCollectionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ department: string }>;
  searchParams?: Promise<{ ay?: string; term?: string }>;
}) {
  const { department } = await params;
  const resolvedSearch = searchParams ? await searchParams : {};
  const ay = resolvedSearch.ay || "A.Y. 2026 - 2027";
  const term = resolvedSearch.term || "1st Sem";

  const organization = await prisma.organization.findUnique({
    where: { subdomain: department },
  });

  if (!organization) {
    return (
      <div className="alert alert-danger p-4 shadow-sm border-secondary">
        <h4 className="fw-bold mb-2">Department Not Found</h4>
        <p className="small mb-0">The department '{decodeURIComponent(department)}' does not exist.</p>
      </div>
    );
  }

  // Fetch Existing Target Funds for the Dropdown
  const funds = await prisma.fund.findMany({
    where: { organizationId: organization.id, academicYear: ay, term },
    orderBy: { fundName: "asc" }
  });

  // Fetch Configured Collection Setups
  const setups = await prisma.collectionSetup.findMany({
    where: { organizationId: organization.id, academicYear: ay, term },
    orderBy: [{ category: "asc" }, { name: "asc" }]
  });

  const fmt = (num: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(num);

  // Server Action Wrappers
  async function handleAddSetupItem(formData: FormData) {
    "use server";
    const category = formData.get("category") as string;
    const name = formData.get("name") as string;
    const amount = parseFloat(formData.get("amount") as string);
    const targetFund = formData.get("targetFund") as string;
    const isPackage = formData.get("isPackage") === "on"; // Checkbox true/false

    await saveCollectionSetupItem(department, {
      category, name, amount, targetFund, isPackage, ay, term
    });
  }

  async function handleDeleteSetupItem(formData: FormData) {
    "use server";
    const id = formData.get("id") as string;
    await deleteCollectionSetupItem(department, id);
  }

  return (
    <div className="module card p-3 p-md-4 border-secondary shadow-sm">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h5 className="text-accent fw-bold mb-0">
          <i className="bi bi-gear-fill me-2"></i>Collection & Package Setup
        </h5>
        <span className="badge bg-secondary px-3 py-2 fs-6">
          {ay} — {term}
        </span>
      </div>

      <div className="row g-4">
        {/* ADD NEW ITEM FORM */}
        <div className="col-12 col-xl-4">
          <div className="card bg-dark border-secondary shadow-sm">
            <div className="card-header border-secondary text-info fw-bold">
              <i className="bi bi-plus-circle me-2"></i>Add Collection Item
            </div>
            <div className="card-body">
              <form action={handleAddSetupItem} className="row g-3 text-white">
                <div className="col-12">
                  <label className="form-label text-secondary small fw-semibold">Category (e.g., Departmental Fee)</label>
                  <input type="text" name="category" className="form-control bg-dark text-white border-secondary" required placeholder="Departmental Fee" />
                </div>
                <div className="col-12">
                  <label className="form-label text-secondary small fw-semibold">Item Name / Description</label>
                  <input type="text" name="name" className="form-control bg-dark text-white border-secondary" required placeholder="e.g., Departmental Shirt" />
                </div>
                <div className="col-12">
                  <label className="form-label text-secondary small fw-semibold">Amount / Standard Rate (₱)</label>
                  <input type="number" name="amount" step="0.01" min="0" className="form-control bg-dark text-info fw-bold border-info" required placeholder="0.00" />
                </div>
                <div className="col-12">
                  <label className="form-label text-secondary small fw-semibold">Target Fund Allocation</label>
                  <select name="targetFund" className="form-select bg-dark text-white border-secondary" required>
                    <option value="">-- Select Target Fund --</option>
                    {funds.map((f) => (
                      <option key={f.id} value={f.fundName}>{f.fundName}</option>
                    ))}
                    <option value="General Fund (Carried Over)">General Fund (Carried Over)</option>
                  </select>
                </div>
                
                {/* THE NEW PACKAGE TOGGLE */}
                <div className="col-12 mt-4">
                  <div className="form-check p-3 border border-secondary rounded bg-dark">
                    <input 
                      type="checkbox" 
                      name="isPackage" 
                      className="form-check-input ms-1 border-secondary" 
                      id="isPackageCheck" 
                      defaultChecked={true} 
                      style={{ cursor: 'pointer' }}
                    />
                    <label className="form-check-label ms-2 fw-bold text-white" htmlFor="isPackageCheck" style={{ cursor: 'pointer' }}>
                      Mandatory Package Item
                    </label>
                    <div className="text-secondary ms-2 mt-1" style={{ fontSize: '0.75rem' }}>
                      Keep checked if this fee is required for student clearance (e.g., core fees). Uncheck for standalone merchandise, optional lunches, or tickets.
                    </div>
                  </div>
                </div>

                <div className="col-12 mt-4">
                  <button type="submit" className="btn btn-info w-100 fw-bold">
                    <i className="bi bi-save me-2"></i>Save Configuration
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* DISPLAY CURRENT SETUP TABLE */}
        <div className="col-12 col-xl-8">
          <div className="card bg-dark border-secondary shadow-sm h-100">
            <div className="card-header border-secondary text-white fw-bold d-flex justify-content-between align-items-center">
              <span><i className="bi bi-list-check me-2"></i>Active Term Configurations</span>
              <span className="badge bg-primary">{setups.length} Items</span>
            </div>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-dark table-hover align-middle mb-0">
                  <thead className="table-secondary text-dark">
                    <tr style={{ fontSize: '0.85rem' }}>
                      <th className="py-3 px-3">Category</th>
                      <th className="py-3">Item Name</th>
                      <th className="py-3 text-end">Amount</th>
                      <th className="py-3">Target Fund</th>
                      <th className="py-3 text-center">Type</th>
                      <th className="py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {setups.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center text-secondary py-5">
                          No collection items configured for this term.
                        </td>
                      </tr>
                    ) : (
                      setups.map((setup) => (
                        <tr key={setup.id}>
                          <td className="px-3 text-secondary fw-semibold small">{setup.category}</td>
                          <td className="fw-bold">{setup.name}</td>
                          <td className="text-end text-info fw-bold">{fmt(setup.amount)}</td>
                          <td className="small text-secondary">{setup.targetFund}</td>
                          <td className="text-center">
                            {setup.isPackage !== false ? (
                              <span className="badge bg-success bg-opacity-25 text-success border border-success border-opacity-50">Package</span>
                            ) : (
                              <span className="badge bg-warning bg-opacity-25 text-warning border border-warning border-opacity-50">Standalone</span>
                            )}
                          </td>
                          <td className="text-center">
                            <form action={handleDeleteSetupItem}>
                              <input type="hidden" name="id" value={setup.id} />
                              <button type="submit" className="btn btn-sm btn-outline-danger px-2 py-1" title="Delete Item">
                                <i className="bi bi-trash"></i>
                              </button>
                            </form>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
    }
