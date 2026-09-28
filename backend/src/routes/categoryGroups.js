import { Router } from 'express';
import { FRENCH } from '../db.js';
import Category from '../models/Category.js';
import CategoryGroup from '../models/CategoryGroup.js';

const router = Router();

router.get('/', async (req, res) => {
  res.json(await CategoryGroup.find().sort({ name: 1 }).collation(FRENCH));
});

router.post('/', async (req, res) => {
  const group = await CategoryGroup.create(req.body);
  res.status(201).json(group);
});

router.put('/:id', async (req, res) => {
  const group = await CategoryGroup.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!group) return res.status(404).json({ error: 'Group not found' });
  res.json(group);
});

// Its categories stay, without a group
router.delete('/:id', async (req, res) => {
  const group = await CategoryGroup.findByIdAndDelete(req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found' });
  await Category.updateMany({ group: group._id }, { group: null });
  res.status(204).end();
});

export default router;
