import { Router } from 'express';
import { findDuplicatePairs, ignoreDuplicatePair } from '../lib/duplicates.js';

const router = Router();

// Saved transactions that may be the same one: [{ a, b, kind, days }]
router.get('/', async (req, res) => {
  res.json(await findDuplicatePairs());
});

// Body: { ids: [a, b] } - "not a duplicate"
router.post('/ignore', async (req, res) => {
  const [a, b] = req.body.ids ?? [];
  if (!a || !b) return res.status(400).json({ error: 'ids doit contenir deux transactions' });
  await ignoreDuplicatePair(a, b);
  res.status(204).end();
});

export default router;
