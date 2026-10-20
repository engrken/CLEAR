import type { Organization } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { toCents } from '@/app/department/[department]/(protected)/realign/ledger';
export const PACKAGE_NAME = 'Departmental Fee Package (All Items)';
export const PACKAGE_FUND_LABEL = 'Multiple Funds (Package Split)';
export const PACKAGE_FEE_PREFIX = 'package:';
export type MobileFeeItem = { id: string; category: string; name: string; amountCentavos: number; targetFund: string; kind: 'package' | 'item'; isPackage: boolean; packageItems?: { id: string; name: string; amountCentavos: number; targetFund: string }[] };
export async function listMobileFeeItems(org: Pick<Organization, 'id' | 'activeAy' | 'activeTerm'>): Promise<MobileFeeItem[]> {
  const setups = await prisma.collectionSetup.findMany({
    where: { organizationId: org.id, academicYear: org.activeAy, term: org.activeTerm },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });

  const out: MobileFeeItem[] = [];
  const categories = [...new Set(setups.map((s) => s.category))];
  for (const category of categories) {
    const inCategory = setups.filter((s) => s.category === category);
    const pkg = inCategory.filter((s) => s.isPackage === true);
    const grouped = pkg.length > 1;
    if (grouped) {
      const items = pkg.map((s) => ({
        id: s.id, name: s.name, amountCentavos: toCents(s.amount), targetFund: s.targetFund,
      }));
      out.push({
        id: `${PACKAGE_FEE_PREFIX}${pkg[0].id}`,
        category,
        name: PACKAGE_NAME,
        amountCentavos: items.reduce((sum, i) => sum + i.amountCentavos, 0),
        targetFund: PACKAGE_FUND_LABEL,
        kind: 'package',
        isPackage: true,
        packageItems: items,
      });
    }
    // Ken's CollectionsForm lists every item of the category after the package option.
    for (const s of inCategory) {
      out.push({
        id: s.id,
        category: s.category,
        name: s.name,
        amountCentavos: toCents(s.amount),
        targetFund: s.targetFund,
        kind: 'item',
        isPackage: s.isPackage === true,
      });
    }
  }
  return out;
}