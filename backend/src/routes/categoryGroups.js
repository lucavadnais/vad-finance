import { Router } from 'express';
import { FRENCH } from '../db.js';
import { pickColor, usedColors } from '../lib/colors.js';
import Category from '../models/Category.js';
import CategoryGroup from '../models/CategoryGroup.js';

const router = Router();

router.get('/', async (req, res) => {
  res.json(await CategoryGroup.find().sort({ name: 1 }).collation(FRENCH));
});

const editable = ({ name, color }) =>
  Object.fromEntries(Object.entries({ name, color }).filter(([, v]) => v !== undefined));

// Without a color, one is drawn among the least used
router.post('/', async (req, res) => {
  const fields = editable(req.body);
  if (!fields.color) fields.color = pickColor(await usedColors());
  const group = await CategoryGroup.create(fields);
  res.status(201).json(group);
});

// Rename or recolor ({ color: null } draws a new color)
router.put('/:id', async (req, res) => {
  const fields = editable(req.body);
  if (fields.color === null || fields.color === '') fields.color = pickColor(await usedColors(req.params.id));
  const group = await CategoryGroup.findByIdAndUpdate(req.params.id, fields, {
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
