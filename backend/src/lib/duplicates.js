// Possible duplicates: the same money movement recorded twice in one account,
// e.g. entered by hand and then imported from the bank statement, or the same
// statement imported twice. Same account and amount, a few days apart at most
// (the bank's posting date often differs from the purchase date).
import Transaction from '../models/Transaction.js';

export const DUPLICATE_MAX_DAYS = 3;
const DAY_MS = 86_400_000;

const normalize = (description = '') => description.trim().replace(/\s+/g, ' ').toLowerCase();
const daysBetween = (a, b) => Math.abs(new Date(a) - new Date(b)) / DAY_MS;

// 'exact' = same day and description (surely the same), 'possible' otherwise
function matchKind(candidate, existing) {
  const sameDay = daysBetween(candidate.date, existing.date) < 1;
  return sameDay && normalize(candidate.description) === normalize(existing.description) ? 'exact' : 'possible';
}

// For each candidate (not saved yet) the existing transaction of `accountId` it
// may duplicate. Each existing transaction matches at most one candidate, exact
// matches first, so a statement with two identical coffees against one saved
// coffee flags only one of them.
export async function checkDuplicates(accountId, candidates) {
  const existing = await Transaction.find(
    { account: accountId },
    'date description amountCents',
  ).lean();

  const pairs = [];
  candidates.forEach((c, index) => {
    for (const e of existing) {
      if (e.amountCents !== c.amountCents) continue;
      const days = daysBetween(c.date, e.date);
      if (days > DUPLICATE_MAX_DAYS) continue;
      pairs.push({ index, existing: e, kind: matchKind(c, e), days });
    }
  });
  pairs.sort((a, b) => (a.kind === b.kind ? a.days - b.days : a.kind === 'exact' ? -1 : 1));

  const used = new Set();
  const byIndex = new Map();
  for (const p of pairs) {
    if (byIndex.has(p.index) || used.has(String(p.existing._id))) continue;
    used.add(String(p.existing._id));
    byIndex.set(p.index, { index: p.index, kind: p.kind, match: p.existing });
  }
  return [...byIndex.values()].sort((a, b) => a.index - b.index);
}

// Pairs of saved transactions that may be the same one. Pairs the user marked
// as "not a duplicate" are skipped, and each transaction appears once.
export async function findDuplicatePairs() {
  const all = await Transaction.find({}, 'account date description amountCents duplicateIgnored')
    .populate('account', 'name')
    .sort({ date: 1 })
    .lean();

  const byKey = new Map(); // account|amount -> transactions, by date
  for (const t of all) {
    const key = `${t.account?._id}|${t.amountCents}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(t);
  }

  const pairs = [];
  for (const list of byKey.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const [a, b] = [list[i], list[j]];
        const days = daysBetween(a.date, b.date);
        if (days > DUPLICATE_MAX_DAYS) break; // sorted by date
        const ignored = (a.duplicateIgnored ?? []).some((id) => String(id) === String(b._id));
        if (!ignored) pairs.push({ a, b, kind: matchKind(a, b), days: Math.round(days) });
      }
    }
  }

  pairs.sort((x, y) => (x.kind === y.kind ? x.days - y.days : x.kind === 'exact' ? -1 : 1));
  const used = new Set();
  return pairs
    .filter((p) => {
      const ids = [String(p.a._id), String(p.b._id)];
      if (ids.some((id) => used.has(id))) return false;
      ids.forEach((id) => used.add(id));
      return true;
    })
    .map(({ a, b, kind, days }) => ({ a: strip(a), b: strip(b), kind, days }));
}

const strip = ({ duplicateIgnored, ...t }) => t;

// "Not a duplicate": remembered on both sides so the pair is not suggested again
export async function ignoreDuplicatePair(idA, idB) {
  await Promise.all([
    Transaction.updateOne({ _id: idA }, { $addToSet: { duplicateIgnored: idB } }),
    Transaction.updateOne({ _id: idB }, { $addToSet: { duplicateIgnored: idA } }),
  ]);
}
