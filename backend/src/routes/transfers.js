import { Router } from 'express';
import Transaction from '../models/Transaction.js';
import {
  createTransfer,
  findTransferCandidates,
  linkTransfer,
  unlinkTransfer,
} from '../lib/transfers.js';

const router = Router();

// Suggested pairs: [{ out, in, daysApart }]
router.get('/candidates', async (req, res) => {
  res.json(await findTransferCandidates());
});

// Body: { from, to, date, description, amountCents (> 0) }
router.post('/', async (req, res) => {
  const [out, inc] = await createTransfer(req.body);
  res.status(201).json({ out, in: inc });
});

// Body: { ids: [a, b] }
router.post('/link', async (req, res) => {
  const [a, b] = req.body.ids ?? [];
  await linkTransfer(a, b);
  res.status(204).end();
});

// Body: { ids: [a, b] } - dismiss a suggested pair
router.post('/ignore', async (req, res) => {
  await Transaction.updateMany({ _id: { $in: req.body.ids ?? [] } }, { transferIgnored: true });
  res.status(204).end();
});

router.delete('/link/:id', async (req, res) => {
  const transaction = await Transaction.findById(req.params.id);
  if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
  await unlinkTransfer(transaction);
  res.status(204).end();
});

export default router;
