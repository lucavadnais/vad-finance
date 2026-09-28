import express, { Router } from 'express';
import Account from '../models/Account.js';
import Transaction from '../models/Transaction.js';

const router = Router();

// Formats a browser can show as an <img>. No SVG: it can carry scripts.
export const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const LOGO_MAX_BYTES = 1024 * 1024;

// The logo is only changed through /:id/logo
function withoutLogo(body) {
  const { logo, logoUpdatedAt, ...rest } = body;
  return rest;
}

// List accounts with their current balance
router.get('/', async (req, res) => {
  const accounts = await Account.find().sort({ name: 1 }).lean();
  const totals = await Transaction.aggregate([
    { $group: { _id: '$account', totalCents: { $sum: '$amountCents' } } },
  ]);
  const totalByAccount = new Map(totals.map((t) => [String(t._id), t.totalCents]));

  res.json(
    accounts.map((a) => ({
      ...a,
      balanceCents: a.initialBalanceCents + (totalByAccount.get(String(a._id)) ?? 0),
    })),
  );
});

router.post('/', async (req, res) => {
  const account = await Account.create(withoutLogo(req.body));
  res.status(201).json(account);
});

router.put('/:id', async (req, res) => {
  const account = await Account.findByIdAndUpdate(req.params.id, withoutLogo(req.body), {
    new: true,
    runValidators: true,
  });
  if (!account) return res.status(404).json({ error: 'Account not found' });
  res.json(account);
});

// Body: the image file itself (Content-Type: image/png, image/jpeg...)
router.put(
  '/:id/logo',
  express.raw({ type: () => true, limit: LOGO_MAX_BYTES }),
  async (req, res) => {
    const contentType = req.get('Content-Type')?.split(';')[0].trim().toLowerCase();
    if (!LOGO_TYPES.includes(contentType)) {
      return res.status(415).json({ error: 'Image PNG, JPEG, WebP ou GIF seulement' });
    }
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({ error: 'Image vide' });
    }
    const account = await Account.findByIdAndUpdate(
      req.params.id,
      { logo: { data: req.body, contentType }, logoUpdatedAt: new Date() },
      { new: true },
    );
    if (!account) return res.status(404).json({ error: 'Account not found' });
    res.json(account);
  },
);

router.delete('/:id/logo', async (req, res) => {
  const account = await Account.findByIdAndUpdate(
    req.params.id,
    { $unset: { logo: 1 }, logoUpdatedAt: null },
    { new: true },
  );
  if (!account) return res.status(404).json({ error: 'Account not found' });
  res.json(account);
});

// The URL carries ?v=<logoUpdatedAt>, so the image can be cached for good
router.get('/:id/logo', async (req, res) => {
  const account = await Account.findById(req.params.id).select('+logo');
  if (!account?.logo?.data) return res.status(404).json({ error: 'Logo not found' });
  res.set({
    'Content-Type': account.logo.contentType,
    'Cache-Control': 'private, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
  });
  res.send(account.logo.data);
});

router.delete('/:id', async (req, res) => {
  const account = await Account.findByIdAndDelete(req.params.id);
  if (!account) return res.status(404).json({ error: 'Account not found' });
  const removed = await Transaction.find({ account: account._id }, '_id');
  await Transaction.deleteMany({ account: account._id });
  // Transfers from other accounts lose their link to the deleted side
  await Transaction.updateMany(
    { transferPeer: { $in: removed.map((t) => t._id) } },
    { transferPeer: null },
  );
  await Transaction.updateMany({ transferAccount: account._id }, { transferAccount: null });
  res.status(204).end();
});

export default router;
