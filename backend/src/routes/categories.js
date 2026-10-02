import { Router } from 'express';
import { FRENCH } from '../db.js';
import Category from '../models/Category.js';
import Projection from '../models/Projection.js';
import Transaction from '../models/Transaction.js';

const router = Router();

router.get('/', async (req, res) => {
  res.json(await Category.find().sort({ kind: 1, name: 1 }).collation(FRENCH));
});

router.post('/', async (req, res) => {
  const category = await Category.create(req.body);
  res.status(201).json(category);
});

// Rename, change kind or move to another group ({ group: null } = no group)
router.put('/:id', async (req, res) => {
  const category = await Category.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!category) return res.status(404).json({ error: 'Category not found' });
  res.json(category);
});

router.delete('/:id', async (req, res) => {
  const category = await Category.findByIdAndDelete(req.params.id);
  if (!category) return res.status(404).json({ error: 'Category not found' });
  await Transaction.updateMany({ category: category._id }, { $unset: { category: 1 } });
  await Projection.updateMany({ category: category._id }, { category: null });
  res.status(204).end();
});

export default router;
