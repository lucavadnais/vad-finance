// Transfers between own accounts: the money leaves one account (negative
// transaction) and arrives in another (positive transaction). A transaction is
// a transfer when it has a `transferAccount` (the other side); once both sides
// are in the app they also point to each other through `transferPeer`.
// Transfers carry no category: they are neither income nor spending.
import Transaction from '../models/Transaction.js';

// Largest gap between the two sides of a transfer (the card payment often
// posts a day or two after it leaves the checking account)
export const MAX_DAYS_APART = 5;
const DAY_MS = 86_400_000;

const httpError = (status, message) => Object.assign(new Error(message), { status });

// Pairs that look like the two sides of one transfer: same amount with opposite
// signs, two different accounts, at most MAX_DAYS_APART apart. Only
// uncategorized, unlinked and not dismissed transactions are considered. Each
// transaction appears in at most one pair, closest dates first.
export async function findTransferCandidates() {
  const pool = await Transaction.find({
    transferPeer: null,
    transferIgnored: { $ne: true },
    category: null,
  })
    .populate('account', 'name')
    .lean();

  const incoming = new Map(); // amount -> positive transactions
  for (const t of pool) {
    if (t.amountCents <= 0) continue;
    if (!incoming.has(t.amountCents)) incoming.set(t.amountCents, []);
    incoming.get(t.amountCents).push(t);
  }

  const pairs = [];
  for (const out of pool) {
    if (out.amountCents >= 0) continue;
    for (const inc of incoming.get(-out.amountCents) ?? []) {
      const daysApart = Math.abs(inc.date - out.date) / DAY_MS;
      if (String(inc.account?._id) === String(out.account?._id) || daysApart > MAX_DAYS_APART) continue;
      // An outgoing side already marked towards another account is not this pair
      if (out.transferAccount && String(out.transferAccount) !== String(inc.account?._id)) continue;
      if (inc.transferAccount && String(inc.transferAccount) !== String(out.account?._id)) continue;
      pairs.push({ out, in: inc, daysApart: Math.round(daysApart) });
    }
  }

  pairs.sort((a, b) => a.daysApart - b.daysApart || b.out.date - a.out.date);
  const used = new Set();
  return pairs.filter((p) => {
    const ids = [String(p.out._id), String(p.in._id)];
    if (ids.some((id) => used.has(id))) return false;
    ids.forEach((id) => used.add(id));
    return true;
  });
}

// Links two existing transactions as the two sides of one transfer
export async function linkTransfer(idA, idB) {
  const [a, b] = await Promise.all([Transaction.findById(idA), Transaction.findById(idB)]);
  if (!a || !b) throw httpError(404, 'Transaction not found');
  if (a.amountCents !== -b.amountCents || a.amountCents === 0) {
    throw httpError(400, 'Les montants doivent être opposés');
  }
  if (String(a.account) === String(b.account)) {
    throw httpError(400, 'Les deux côtés doivent être dans des comptes différents');
  }
  if ((a.transferPeer && String(a.transferPeer) !== String(b._id)) ||
      (b.transferPeer && String(b.transferPeer) !== String(a._id))) {
    throw httpError(409, 'Une des transactions est déjà liée à un autre transfert');
  }

  await Promise.all([
    Transaction.updateOne({ _id: a._id }, { category: null, transferAccount: b.account, transferPeer: b._id }),
    Transaction.updateOne({ _id: b._id }, { category: null, transferAccount: a.account, transferPeer: a._id }),
  ]);
}

// Creates both sides of a transfer at once (manual entry)
export async function createTransfer({ from, to, date, description = '', amountCents }) {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw httpError(400, 'Le montant doit être positif');
  }
  if (!from || !to || String(from) === String(to)) {
    throw httpError(400, 'Choisis deux comptes différents');
  }
  const [out, inc] = await Transaction.create([
    { account: from, date, description, amountCents: -amountCents, transferAccount: to },
    { account: to, date, description, amountCents, transferAccount: from },
  ]);
  await Promise.all([
    Transaction.updateOne({ _id: out._id }, { transferPeer: inc._id }),
    Transaction.updateOne({ _id: inc._id }, { transferPeer: out._id }),
  ]);
  return [out, inc];
}

// Breaks the link on both sides (each keeps its other account)
export async function unlinkTransfer(transaction) {
  if (transaction.transferPeer) {
    await Transaction.updateOne({ _id: transaction.transferPeer }, { transferPeer: null });
  }
  await Transaction.updateOne({ _id: transaction._id }, { transferPeer: null });
}

// Keeps transfer fields consistent after a create or an edit: a transfer has
// no category, and a transaction that is no longer a transfer loses its link
export async function syncTransferAfterUpdate(transaction) {
  if (transaction.transferAccount) {
    if (transaction.category) await Transaction.updateOne({ _id: transaction._id }, { category: null });
  } else if (transaction.transferPeer) {
    await unlinkTransfer(transaction);
  }
}
