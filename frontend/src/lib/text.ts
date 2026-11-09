// Text compared ignoring accents, case and surrounding spaces: "electricite"
// matches " Électricité"
export const normalizeText = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

// Whether a transaction matches a search, like the transactions table's: its
// description, account or category name (every word typed, in any order,
// without accents or case), or its amount ("12,50" or "50 000 $" finds ±12.50
// or ±50 000)
export function matchesTransaction(
  t: {
    description: string;
    amountCents: number;
    account?: { name: string } | null;
    category?: { name: string } | null;
  },
  query: string,
) {
  const words = normalizeText(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const text = normalizeText(`${t.description} ${t.account?.name ?? ''} ${t.category?.name ?? ''}`);
  if (words.every((w) => text.includes(w))) return true;
  const amount = query.replace(/[\s$]/g, '').replace(',', '.');
  return /^-?\d+(\.\d{1,2})?$/.test(amount) && Math.abs(t.amountCents) === Math.abs(Math.round(Number(amount) * 100));
}
