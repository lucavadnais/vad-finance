import { Router } from 'express';
import { getSettings } from '../models/Setting.js';

const router = Router();

router.get('/', async (req, res) => {
  res.json(await getSettings());
});

// Body: the fields to change
router.put('/', async (req, res) => {
  const settings = await getSettings();
  if (req.body.budgetBufferCents !== undefined) settings.budgetBufferCents = req.body.budgetBufferCents;
  await settings.save();
  res.json(settings);
});

export default router;
