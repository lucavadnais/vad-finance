import express, { Router } from 'express';
import Account from '../models/Account.js';
import Transaction from '../models/Transaction.js';
import {
  accountNameFromFileName,
  bankFromFileName,
  parseTransactionsCsv,
} from '../lib/parseTransactionsCsv.js';

const router = Router();

// Body: raw CSV file, ?fileName=<original file name>. Returns the parsed
// transactions, the account name and the bank (both taken from the file name)
// without saving.
router.post(
  '/parse-csv',
  express.text({ type: 'text/csv', limit: '5mb' }),
  (req, res) => {
    if (typeof req.body !== 'string' || !req.body.trim()) {
      return res.status(400).json({ error: 'Fichier CSV vide ou manquant' });
    }
    res.json({
      accountName: accountNameFromFileName(req.query.fileName),
      bank: bankFromFileName(req.query.fileName),
      ...parseTransactionsCsv(req.body),
    });
  },
);

// Body: { account, transactions: [{ date, description, amountCents }] }
// Skips transactions already in the account, so importing the same file twice
// adds nothing. Identical rows (same date, description and amount) are compared
// by count: a file with two identical coffees adds two, re-importing it adds none.
router.post('/import', async (req, res) => {
  const { account: accountId, transactions } = req.body;
  if (!Array.isArray(transactions)) {
    return res.status(400).json({ error: 'transactions doit être une liste' });
  }
  if (transactions.some((t) => Number.isNaN(Date.parse(t.date)) || !Number.isInteger(t.amountCents))) {
    return res.status(400).json({ error: 'Transaction avec une date ou un montant invalide' });
  }
  const account = await Account.findById(accountId);
  if (!account) return res.status(404).json({ error: 'Account not found' });

  const key = (t) => `${new Date(t.date).toISOString()}|${t.description}|${t.amountCents}`;
  const existingCount = new Map();
  const existing = await Transaction.find({ account: account._id }, 'date description amountCents');
  for (const t of existing) existingCount.set(key(t), (existingCount.get(key(t)) ?? 0) + 1);

  const toInsert = [];
  for (const t of transactions) {
    const doc = { account: account._id, date: t.date, description: t.description ?? '', amountCents: t.amountCents };
    const k = key(doc);
    if (existingCount.get(k) > 0) existingCount.set(k, existingCount.get(k) - 1);
    else toInsert.push(doc);
  }

  await Transaction.insertMany(toInsert);
  res.status(201).json({ inserted: toInsert.length, skipped: transactions.length - toInsert.length });
});

// Optional filters: ?account=<id>&from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/', async (req, res) => {
  const { account, from, to } = req.query;
  const filter = {};
  if (account) filter.account = account;
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to) filter.date.$lte = new Date(to);
  }

  const transactions = await Transaction.find(filter)
    .sort({ date: -1 })
    .populate('account', 'name')
    .populate('category', 'name kind');
  res.json(transactions);
});

router.post('/', async (req, res) => {
  const transaction = await Transaction.create(req.body);
  res.status(201).json(transaction);
});

router.put('/:id', async (req, res) => {
  const transaction = await Transaction.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
  res.json(transaction);
});

router.delete('/:id', async (req, res) => {
  const transaction = await Transaction.findByIdAndDelete(req.params.id);
  if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
  res.status(204).end();
});

export default router;
