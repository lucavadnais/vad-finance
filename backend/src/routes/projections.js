import { Router } from 'express';
import { FRENCH } from '../db.js';
import Projection from '../models/Projection.js';

const router = Router();

router.get('/', async (req, res) => {
  res.json(await Projection.find().sort({ kind: 1, name: 1 }).collation(FRENCH));
});

router.post('/', async (req, res) => {
  const projection = await Projection.create(req.body);
  res.status(201).json(projection);
});

// The whole projection is sent back by the form: replace it, so the month and
// year left over from another recurrence are cleared too
router.put('/:id', async (req, res) => {
  const projection = await Projection.findById(req.params.id);
  if (!projection) return res.status(404).json({ error: 'Projection not found' });
  const {
    name,
    kind,
    amountCents,
    dayOfMonth,
    recurrence,
    month = null,
    year = null,
    endDate = null,
    category = null,
  } = req.body;
  projection.set({ name, kind, amountCents, dayOfMonth, recurrence, month, year, endDate, category });
  await projection.save();
  res.json(projection);
});

router.delete('/:id', async (req, res) => {
  const projection = await Projection.findByIdAndDelete(req.params.id);
  if (!projection) return res.status(404).json({ error: 'Projection not found' });
  res.status(204).end();
});

export default router;
