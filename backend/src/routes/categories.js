import { Router } from 'express';
import { FRENCH } from '../db.js';
import { pickColor, usedColors } from '../lib/colors.js';
import Category from '../models/Category.js';
import Projection from '../models/Projection.js';
import Transaction from '../models/Transaction.js';

const router = Router();

router.get('/', async (req, res) => {
  res.json(await Category.find().sort({ kind: 1, name: 1 }).collation(FRENCH));
});

const FIELDS = ['name', 'kind', 'group', 'color', 'shade', 'archived'];
const editable = (body) => Object.fromEntries(FIELDS.filter((k) => body[k] !== undefined).map((k) => [k, body[k]]));

// Without a color, one is drawn among the least used. It only shows while the
// category has no group: in one, it takes a shade of the group's color.
router.post('/', async (req, res) => {
  const fields = editable(req.body);
  if (!fields.color) fields.color = pickColor(await usedColors());
  const category = await Category.create(fields);
  res.status(201).json(category);
});

// Rename, change kind or color, archive, move to another group ({ group: null } = no
// group). { color: null } draws a new color.
// An archived category cannot change, except to be unarchived.
router.put('/:id', async (req, res) => {
  const fields = editable(req.body);
  const current = await Category.findById(req.params.id, 'archived').lean();
  if (!current) return res.status(404).json({ error: 'Category not found' });
  if (current.archived && !(fields.archived === false && Object.keys(fields).length === 1)) {
    return res.status(409).json({ error: 'Désarchivez la catégorie pour la modifier' });
  }
  if (fields.color === null || fields.color === '') fields.color = pickColor(await usedColors(req.params.id));
  const category = await Category.findByIdAndUpdate(req.params.id, fields, {
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
