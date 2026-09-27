import { Router } from 'express';
import Transaction from '../models/Transaction.js';

const router = Router();

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
