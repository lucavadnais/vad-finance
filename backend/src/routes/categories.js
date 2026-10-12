import { Router } from 'express';
import { FRENCH } from '../db.js';
import { pickColor, usedColors } from '../lib/colors.js';
import Category from '../models/Category.js';
import CategoryGroup from '../models/CategoryGroup.js';
import Projection from '../models/Projection.js';
import Transaction from '../models/Transaction.js';

const router = Router();

router.get('/', async (req, res) => {
  res.json(await Category.find({ user: req.userId }).sort({ kind: 1, name: 1 }).collation(FRENCH));
});

const FIELDS = ['name', 'kind', 'group', 'color', 'shade', 'archived'];
const editable = (body) => Object.fromEntries(FIELDS.filter((k) => body[k] !== undefined).map((k) => [k, body[k]]));

// Without a color, one is drawn among the least used. It only shows while the
// category has no group: in one, it takes a shade of the group's color.
router.post('/', async (req, res) => {
  const fields = editable(req.body);
  await CategoryGroup.checkOwned(req.userId, fields.group);
  if (!fields.color) fields.color = pickColor(await usedColors(req.userId));
  const category = await Category.create({ ...fields, user: req.userId });
  res.status(201).json(category);
});

// Rename, change kind or color, archive, move to another group ({ group: null } = no
// group). { color: null } draws a new color.
// An archived category cannot change, except to be unarchived.
router.put('/:id', async (req, res) => {
  const fields = editable(req.body);
  const filter = { _id: req.params.id, user: req.userId };
  const current = await Category.findOne(filter, 'archived').lean();
  if (!current) return res.status(404).json({ error: 'Category not found' });
  if (current.archived && !(fields.archived === false && Object.keys(fields).length === 1)) {
    return res.status(409).json({ error: 'Désarchivez la catégorie pour la modifier' });
  }
  await CategoryGroup.checkOwned(req.userId, fields.group);
  if (fields.color === null || fields.color === '') {
    fields.color = pickColor(await usedColors(req.userId, req.params.id));
  }
  const category = await Category.findOneAndUpdate(filter, fields, {
    new: true,
    runValidators: true,
  });
  if (!category) return res.status(404).json({ error: 'Category not found' });
  res.json(category);
});

router.delete('/:id', async (req, res) => {
  const user = req.userId;
  const category = await Category.findOneAndDelete({ _id: req.params.id, user });
  if (!category) return res.status(404).json({ error: 'Category not found' });
  await Transaction.updateMany({ user, category: category._id }, { $unset: { category: 1 } });
  await Projection.updateMany({ user, category: category._id }, { category: null });
  res.status(204).end();
});

export default router;
