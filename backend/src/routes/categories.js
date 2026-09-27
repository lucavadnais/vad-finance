import { Router } from 'express';
import Category from '../models/Category.js';

const router = Router();

router.get('/', async (req, res) => {
  res.json(await Category.find().sort({ kind: 1, name: 1 }));
});

router.post('/', async (req, res) => {
  const category = await Category.create(req.body);
  res.status(201).json(category);
});

router.delete('/:id', async (req, res) => {
  const category = await Category.findByIdAndDelete(req.params.id);
  if (!category) return res.status(404).json({ error: 'Category not found' });
  res.status(204).end();
});

export default router;
