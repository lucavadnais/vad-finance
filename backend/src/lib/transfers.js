// Transfers between own accounts: the money leaves one account (negative
// transaction) and arrives in another (positive transaction). A transaction is
// a transfer when it has a `transferAccount` (the other side); once both sides
// are in the app they also point to each other through `transferPeer`. When
// the other side is not in the app (e.g. an account whose statement is never
// imported), the app creates it (`autoCreated`) until the real one is imported.
// Transfers carry no category: they are neither income nor spending.
import Account from '../models/Account.js';
import Transaction from '../models/Transaction.js';

// Largest gap between the two sides of a transfer (the card payment often
// posts a day or two after it leaves the checking account)
export const MAX_DAYS_APART = 5;
const DAY_MS = 86_400_000;

const httpError = (status, message) => Object.assign(new Error(message), { status });

// Pairs of the user's transactions that look like the two sides of one
// transfer: same amount with opposite signs, two different accounts, at most
// MAX_DAYS_APART apart. Only uncategorized, unlinked and not dismissed
// transactions are considered. Each transaction appears in at most one pair,
// closest dates first.
export async function findTransferCandidates(user) {
  const pool = await Transaction.find({
    user,
    transferPeer: null,
    transferIgnored: { $ne: true },
    category: null,
  })
    .populate({ path: 'account', select: 'name', match: { user } })
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

// Links two existing transactions of the user as the two sides of one transfer
export async function linkTransfer(user, idA, idB) {
  const [a, b] = await Promise.all([
    Transaction.findOne({ _id: idA, user }),
    Transaction.findOne({ _id: idB, user }),
  ]);
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
    Transaction.updateOne({ _id: a._id, user }, { category: null, transferAccount: b.account, transferPeer: b._id }),
    Transaction.updateOne({ _id: b._id, user }, { category: null, transferAccount: a.account, transferPeer: a._id }),
  ]);
}

// After an import, links new rows to the other side of their transfer when
// that side is already in the app (same amount with the opposite sign, at most
// MAX_DAYS_APART apart, neither side linked yet). Two cases:
// - a new row marked as a transfer (it has a transferAccount) finds an
//   uncategorized row in that account, not marked towards a third account;
// - a new uncategorized row finds a row in another account already marked as
//   a transfer towards this account (the other statement came first).
// Closest date wins; each transaction is used once. Returns the pairs linked.
export async function autoLinkTransfers(transactions) {
  let linked = 0;
  const used = new Set(transactions.map((t) => String(t._id)));
  const around = (date) => ({
    $gte: new Date(new Date(date).getTime() - MAX_DAYS_APART * DAY_MS),
    $lte: new Date(new Date(date).getTime() + MAX_DAYS_APART * DAY_MS),
  });

  for (const t of transactions) {
    if (t.transferPeer) continue;
    const filter = t.transferAccount
      ? {
          account: t.transferAccount,
          category: null,
          transferAccount: { $in: [null, t.account] },
        }
      : t.category
        ? null // an expense or income row is not a transfer
        : { account: { $ne: t.account }, transferAccount: t.account };
    if (!filter) continue;

    const candidates = await Transaction.find({
      user: t.user,
      ...filter,
      amountCents: -t.amountCents,
      transferPeer: null,
      date: around(t.date),
    }).lean();
    const match = candidates
      .filter((c) => !used.has(String(c._id)))
      .sort((a, b) => Math.abs(a.date - t.date) - Math.abs(b.date - t.date))[0];
    if (!match) continue;
    used.add(String(match._id));
    await linkTransfer(t.user, t._id, match._id);
    linked++;
  }
  return linked;
}

// Creates both sides of a transfer between two accounts of the user (manual entry)
export async function createTransfer(user, { from, to, date, description = '', amountCents }) {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw httpError(400, 'Le montant doit être positif');
  }
  if (!from || !to || String(from) === String(to)) {
    throw httpError(400, 'Choisissez deux comptes différents');
  }
  await Account.checkOwned(user, from, to);
  const [out, inc] = await Transaction.create([
    { user, account: from, date, description, amountCents: -amountCents, transferAccount: to },
    { user, account: to, date, description, amountCents, transferAccount: from },
  ]);
  await Promise.all([
    Transaction.updateOne({ _id: out._id, user }, { transferPeer: inc._id }),
    Transaction.updateOne({ _id: inc._id, user }, { transferPeer: out._id }),
  ]);
  return [out, inc];
}

// Breaks the link on both sides (each keeps its other account)
export async function unlinkTransfer(transaction) {
  const { user } = transaction;
  if (transaction.transferPeer) {
    await Transaction.updateOne({ _id: transaction.transferPeer, user }, { transferPeer: null });
  }
  await Transaction.updateOne({ _id: transaction._id, user }, { transferPeer: null });
}

// Creates the other side of a transfer that has none, in its other account:
// same date and description, opposite amount, linked both ways
export async function createMissingSide(transaction) {
  const { user } = transaction;
  const peer = await Transaction.create({
    user,
    account: transaction.transferAccount,
    date: transaction.date,
    description: transaction.description,
    amountCents: -transaction.amountCents,
    transferAccount: transaction.account,
    transferPeer: transaction._id,
    autoCreated: true,
  });
  await Transaction.updateOne({ _id: transaction._id, user }, { transferPeer: peer._id });
  return peer;
}

// After an import: the imported transfers still without their other side (no
// match in autoLinkTransfers) get one. Returns how many were created.
export async function createMissingSides(transactions) {
  const ids = transactions.filter((t) => t.transferAccount).map((t) => t._id);
  if (!ids.length) return 0;
  const lone = await Transaction.find({ user: transactions[0].user, _id: { $in: ids }, transferPeer: null });
  for (const t of lone) await createMissingSide(t);
  return lone.length;
}

// Rows about to be imported into `account` that are the real version of a side
// the app created (same amount, at most MAX_DAYS_APART apart, closest date
// first) take its place: that side gets the real date and description and
// keeps its link, so the statement adds no duplicate. Returns the rows left to
// insert and how many replaced a created side.
export async function replaceAutoCreated(user, account, rows) {
  const created = await Transaction.find({ user, account, autoCreated: true }).lean();
  if (!created.length) return { rest: rows, replaced: 0 };

  const pairs = [];
  rows.forEach((row, index) => {
    for (const c of created) {
      if (c.amountCents !== row.amountCents) continue;
      // A row marked as a transfer towards a third account is not this one
      if (row.transferAccount && String(row.transferAccount) !== String(c.transferAccount)) continue;
      const days = Math.abs(new Date(row.date) - c.date) / DAY_MS;
      if (days <= MAX_DAYS_APART) pairs.push({ index, created: c, days });
    }
  });
  pairs.sort((a, b) => a.days - b.days);

  const usedRows = new Set();
  const usedCreated = new Set();
  for (const { index, created: c } of pairs) {
    if (usedRows.has(index) || usedCreated.has(String(c._id))) continue;
    usedRows.add(index);
    usedCreated.add(String(c._id));
    const { date, description } = rows[index];
    await Transaction.updateOne({ _id: c._id, user }, { date, description, autoCreated: false });
  }
  return { rest: rows.filter((_, i) => !usedRows.has(i)), replaced: usedRows.size };
}

// Deletes a transaction. A side the app created goes with it; a real other
// side stays, unlinked.
export async function deleteTransaction(transaction) {
  const { user } = transaction;
  const peer = transaction.transferPeer && (await Transaction.findOne({ _id: transaction.transferPeer, user }));
  if (peer?.autoCreated) await Transaction.deleteOne({ _id: peer._id, user });
  else await unlinkTransfer(transaction);
  await Transaction.deleteOne({ _id: transaction._id, user });
}

// Keeps transfer fields consistent after a create or an edit:
// - a transfer has no category, and has its other side: the side the app
//   created follows the edits; a real side in another account than the chosen
//   one is unlinked; without a side, an existing match is linked, or else the
//   side is created;
// - a transaction that is no longer a transfer loses its link, and the side
//   the app created for it.
export async function syncTransferAfterUpdate(transaction) {
  const { user } = transaction;
  let peer = transaction.transferPeer && (await Transaction.findOne({ _id: transaction.transferPeer, user }));

  if (!transaction.transferAccount) {
    if (peer?.autoCreated) {
      await Transaction.deleteOne({ _id: peer._id, user });
      await Transaction.updateOne({ _id: transaction._id, user }, { transferPeer: null });
    } else if (transaction.transferPeer) {
      await unlinkTransfer(transaction);
    }
    return;
  }

  if (transaction.category) {
    await Transaction.updateOne({ _id: transaction._id, user }, { category: null });
  }
  if (peer?.autoCreated) {
    await Transaction.updateOne(
      { _id: peer._id, user },
      {
        account: transaction.transferAccount,
        transferAccount: transaction.account,
        date: transaction.date,
        description: transaction.description,
        amountCents: -transaction.amountCents,
      },
    );
    return;
  }
  if (peer && String(peer.account) !== String(transaction.transferAccount)) {
    await unlinkTransfer(transaction);
    peer = null;
  }
  if (!peer) {
    const lone = { ...transaction.toObject(), transferPeer: null };
    if (!(await autoLinkTransfers([lone]))) await createMissingSide(lone);
  }
}
