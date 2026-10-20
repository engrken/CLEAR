export type CollectionCreditRow = {
  itemDescription: string;
  amountPaid: number;
  status: string | null;
  paymentType: string | null;
};
export type CollectionCredit = { itemDescription: string; paidCents: number };
export function summarizeValidCollectionCredits(
  rows: ReadonlyArray<CollectionCreditRow>
): CollectionCredit[];
export function calculateCollectionBalancePreview(input: {
  credits: ReadonlyArray<CollectionCredit>;
  itemDescription: string;
  standardRate: number;
  packageItems?: ReadonlyArray<{ name: string; amount: number }>;
  isPenalty?: boolean;
  penaltyBalance?: number | null;
  prefillLimit?: number | null;
}): { dueCents: number; alreadyPaidCents: number; payableCents: number };
