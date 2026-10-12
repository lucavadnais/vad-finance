import { Router } from 'express';
import { FRENCH } from '../db.js';
import Category from '../models/Category.js';
import Projection from '../models/Projection.js';

const router = Router();

router.get('/', async (req, res) => {
  res.json(await Projection.find({ user: req.userId }).sort({ kind: 1, name: 1 }).collation(FRENCH));
});

router.post('/', async (req, res) => {
  await Category.checkOwned(req.userId, req.body.category);
  const projection = await Projection.create({ ...req.body, user: req.userId });
  res.status(201).json(projection);
});

// The whole projection is sent back by the form: replace it, so an end date
// left over from a repeating one is cleared too
router.put('/:id', async (req, res) => {
  const projection = await Projection.findOne({ _id: req.params.id, user: req.userId });
  if (!projection) return res.status(404).json({ error: 'Projection not found' });
  const {
    name,
    kind,
    amountCents,
    recurrence,
    interval = 1,
    startDate,
    endDate = null,
    category = null,
  } = req.body;
  await Category.checkOwned(req.userId, category);
  projection.set({ name, kind, amountCents, recurrence, interval, startDate, endDate, category });
  await projection.save();
  res.json(projection);
});

router.delete('/:id', async (req, res) => {
  const projection = await Projection.findOneAndDelete({ _id: req.params.id, user: req.userId });
  if (!projection) return res.status(404).json({ error: 'Projection not found' });
  res.status(204).end();
});

export default router;
