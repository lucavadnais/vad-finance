import { Router } from 'express';
import Account from '../models/Account.js';
import Transaction from '../models/Transaction.js';

const router = Router();

// List accounts with their current balance
router.get('/', async (req, res) => {
  const accounts = await Account.find().sort({ name: 1 }).lean();
  const totals = await Transaction.aggregate([
    { $group: { _id: '$account', totalCents: { $sum: '$amountCents' } } },
  ]);
  const totalByAccount = new Map(totals.map((t) => [String(t._id), t.totalCents]));

  res.json(
    accounts.map((a) => ({
      ...a,
      balanceCents: a.initialBalanceCents + (totalByAccount.get(String(a._id)) ?? 0),
    })),
  );
});

router.post('/', async (req, res) => {
  const account = await Account.create(req.body);
  res.status(201).json(account);
});

router.put('/:id', async (req, res) => {
  const account = await Account.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!account) return res.status(404).json({ error: 'Account not found' });
  res.json(account);
});

router.delete('/:id', async (req, res) => {
  const account = await Account.findByIdAndDelete(req.params.id);
  if (!account) return res.status(404).json({ error: 'Account not found' });
  await Transaction.deleteMany({ account: account._id });
  res.status(204).end();
});

export default router;
