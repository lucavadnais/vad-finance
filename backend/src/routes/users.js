import { Router } from 'express';
import { COOKIE } from '../lib/auth.js';
import Account from '../models/Account.js';
import Category from '../models/Category.js';
import CategoryGroup from '../models/CategoryGroup.js';
import Projection from '../models/Projection.js';
import Session from '../models/Session.js';
import Setting from '../models/Setting.js';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';

const router = Router();

// Deletes the signed-in user and everything they own, for good. The user goes
// last: if a step fails, they can still sign in and try again.
router.delete('/me', async (req, res) => {
  const user = req.userId;
  for (const Model of [Transaction, Projection, Category, CategoryGroup, Account, Setting]) {
    await Model.deleteMany({ user });
  }
  await Session.deleteMany({ user });
  await User.deleteOne({ _id: user });
  res.clearCookie(COOKIE, { path: '/' });
  res.status(204).end();
});

export default router;
