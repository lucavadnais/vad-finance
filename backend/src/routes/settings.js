import { Router } from 'express';
import { getSettings } from '../models/Setting.js';

const router = Router();

router.get('/', async (req, res) => {
  res.json(await getSettings(req.userId));
});

// Body: the fields to change
router.put('/', async (req, res) => {
  const settings = await getSettings(req.userId);
  if (req.body.budgetBufferCents !== undefined) settings.budgetBufferCents = req.body.budgetBufferCents;
  if (req.body.chartAxes !== undefined) settings.chartAxes = req.body.chartAxes;
  if (req.body.onboardingDone !== undefined) settings.onboardingDone = req.body.onboardingDone;
  await settings.save();
  res.json(settings);
});

export default router;
