import express, { Router } from 'express';
import Account from '../models/Account.js';
import Category from '../models/Category.js';
import Transaction from '../models/Transaction.js';
import { checkDuplicates } from '../lib/duplicates.js';
import {
  autoLinkTransfers,
  createMissingSides,
  deleteTransaction,
  replaceAutoCreated,
  syncTransferAfterUpdate,
} from '../lib/transfers.js';
import { parseTransactionsCsv } from '../lib/parseTransactionsCsv.js';

const router = Router();

// Body: raw CSV file. Returns the parsed transactions without saving them
// (the user picks the account in the import preview).
router.post(
  '/parse-csv',
  express.text({ type: 'text/csv', limit: '5mb' }),
  (req, res) => {
    if (typeof req.body !== 'string' || !req.body.trim()) {
      return res.status(400).json({ error: 'Fichier CSV vide ou manquant' });
    }
    res.json(parseTransactionsCsv(req.body));
  },
);

// Body: { account, transactions: [{ date, description, amountCents }] }
// Returns [{ index, kind: 'exact' | 'possible', match }] for the rows that may
// already be in the account (see lib/duplicates.js)
router.post('/check-duplicates', async (req, res) => {
  const { account, transactions } = req.body;
  if (!Array.isArray(transactions)) {
    return res.status(400).json({ error: 'transactions doit être une liste' });
  }
  await Account.checkOwned(req.userId, account);
  res.json(await checkDuplicates(req.userId, account, transactions));
});

// Body: { account, transactions: [{ date, description, amountCents, category?, transferAccount? }], allowDuplicates?, currentBalanceCents? }
// By default skips transactions already in the account, so importing the same
// file twice adds nothing. Identical rows (same date, description and amount)
// are compared by count: a file with two identical coffees adds two,
// re-importing it adds none. `allowDuplicates` inserts every row as given (the
// user already reviewed the duplicates in the import preview).
// Rows that are the real version of a transfer side the app created replace
// it. Imported transfers are linked to their other side, created when missing.
// `currentBalanceCents`, the account's balance today as the bank shows it,
// sets the initial balance so that the balance after the import matches it,
// whatever the account held before (created transfer sides included).
// Returns { inserted, skipped, linked, created }.
router.post('/import', async (req, res) => {
  const { account: accountId, transactions, allowDuplicates } = req.body;
  if (!Array.isArray(transactions)) {
    return res.status(400).json({ error: 'transactions doit être une liste' });
  }
  if (transactions.some((t) => Number.isNaN(Date.parse(t.date)) || !Number.isInteger(t.amountCents))) {
    return res.status(400).json({ error: 'Transaction avec une date ou un montant invalide' });
  }
  const { currentBalanceCents } = req.body;
  if (currentBalanceCents != null && !Number.isInteger(currentBalanceCents)) {
    return res.status(400).json({ error: 'Solde invalide' });
  }
  const user = req.userId;
  const account = await Account.findOne({ _id: accountId, user });
  if (!account) return res.status(404).json({ error: 'Account not found' });
  if (transactions.some((t) => t.transferAccount && String(t.transferAccount) === String(account._id))) {
    return res.status(400).json({ error: "Un transfert doit aller vers un autre compte" });
  }
  await Account.checkOwned(user, transactions.map((t) => t.transferAccount));
  await Category.checkOwned(user, transactions.map((t) => !t.transferAccount && t.category));

  const key = (t) => `${new Date(t.date).toISOString()}|${t.description}|${t.amountCents}`;
  const existingCount = new Map();
  const existing = await Transaction.find(
    { user, account: account._id, autoCreated: { $ne: true } },
    'date description amountCents',
  );
  for (const t of existing) existingCount.set(key(t), (existingCount.get(key(t)) ?? 0) + 1);

  const toInsert = [];
  for (const t of transactions) {
    const doc = {
      user,
      account: account._id,
      date: t.date,
      description: t.description ?? '',
      amountCents: t.amountCents,
      // Chosen in the import preview. A transfer between own accounts has no category.
      category: t.transferAccount ? null : t.category || null,
      transferAccount: t.transferAccount || null,
    };
    const k = key(doc);
    if (!allowDuplicates && existingCount.get(k) > 0) existingCount.set(k, existingCount.get(k) - 1);
    else toInsert.push(doc);
  }

  const { rest, replaced } = await replaceAutoCreated(user, account._id, toInsert);
  const inserted = await Transaction.insertMany(rest);
  // Rows marked as transfers get linked to their other side when it is already
  // here, or else get one
  const linked = await autoLinkTransfers(inserted);
  const created = await createMissingSides(inserted);
  const count = inserted.length + replaced;
  if (currentBalanceCents != null) {
    const [sum] = await Transaction.aggregate([
      { $match: { user, account: account._id } },
      { $group: { _id: null, totalCents: { $sum: '$amountCents' } } },
    ]);
    await Account.updateOne(
      { _id: account._id, user },
      { initialBalanceCents: currentBalanceCents - (sum?.totalCents ?? 0) },
    );
  }
  res.status(201).json({ inserted: count, skipped: transactions.length - count, linked: linked + replaced, created });
});

const MAX_PAGE_SIZE = 200;

// Letters that also match their accented forms, so "cafe" finds "Café"
const ACCENTS = { a: 'aàâä', c: 'cç', e: 'eéèêë', i: 'iîï', o: 'oôö', u: 'uùûü', y: 'yÿ' };

// Case- and accent-insensitive regex matching `text` anywhere
function searchRegex(text) {
  const pattern = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/[aceiouy]/gi, (c) => {
      const letters = ACCENTS[c.toLowerCase()];
      return `[${letters}${letters.toUpperCase()}]`;
    });
  return new RegExp(pattern, 'i');
}

// ?q=: description, account or category name, or amount ("12,50" finds ±12.50)
async function searchFilter(user, q) {
  const re = searchRegex(q);
  const [accounts, categories] = await Promise.all([
    Account.find({ user, name: re }, '_id'),
    Category.find({ user, name: re }, '_id'),
  ]);
  const or = [
    { description: re },
    { account: { $in: accounts.map((a) => a._id) } },
    { category: { $in: categories.map((c) => c._id) } },
  ];
  const amount = q.replace(/\s/g, '').replace(',', '.');
  if (/^-?\d+(\.\d{1,2})?$/.test(amount)) {
    const cents = Math.abs(Math.round(Number(amount) * 100));
    or.push({ amountCents: { $in: [cents, -cents] } });
  }
  return { $or: or };
}

// Optional filters: ?account=<id>&from=YYYY-MM-DD&to=YYYY-MM-DD&q=<search>
// With ?page=<n>&pageSize=<m> (page starts at 1) returns one page:
// { items, total, page, pageSize }. Without `page`, the whole list (charts).
router.get('/', async (req, res) => {
  const { account, from, to } = req.query;
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const user = req.userId;
  const filter = { ...(q && (await searchFilter(user, q))), user };
  if (account) filter.account = account;
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to) filter.date.$lte = new Date(to);
  }

  // Newest first; _id breaks ties so pages never overlap or skip rows
  const query = () =>
    Transaction.find(filter)
      .sort({ date: -1, _id: -1 })
      .populate({ path: 'account', select: 'name logoUpdatedAt', match: { user } })
      .populate({ path: 'category', select: 'name kind color', match: { user } })
      .populate({ path: 'transferAccount', select: 'name', match: { user } });

  if (req.query.page === undefined) return res.json(await query());

  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 25, 1), MAX_PAGE_SIZE);
  const total = await Transaction.countDocuments(filter);
  const lastPage = Math.max(Math.ceil(total / pageSize), 1);
  // A page past the end (e.g. after deleting its last row) gives the last one
  const page = Math.min(Math.max(parseInt(req.query.page, 10) || 1, 1), lastPage);
  const items = await query().skip((page - 1) * pageSize).limit(pageSize);
  res.json({ items, total, page, pageSize });
});

// Links between the two sides of a transfer go through /api/transfers only.
// The account, category and other side of a transfer must be the user's.
async function editable(user, body) {
  const { transferPeer, transferIgnored, duplicateIgnored, user: _, ...rest } = body;
  await Account.checkOwned(user, rest.account, rest.transferAccount);
  await Category.checkOwned(user, rest.category);
  return rest;
}

router.post('/', async (req, res) => {
  const transaction = await Transaction.create({ ...(await editable(req.userId, req.body)), user: req.userId });
  await syncTransferAfterUpdate(transaction);
  res.status(201).json(transaction);
});

router.put('/:id', async (req, res) => {
  const transaction = await Transaction.findOneAndUpdate(
    { _id: req.params.id, user: req.userId },
    await editable(req.userId, req.body),
    { new: true, runValidators: true },
  );
  if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
  await syncTransferAfterUpdate(transaction);
  res.json(transaction);
});

router.delete('/:id', async (req, res) => {
  const transaction = await Transaction.findOne({ _id: req.params.id, user: req.userId });
  if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
  await deleteTransaction(transaction);
  res.status(204).end();
});

export default router;
