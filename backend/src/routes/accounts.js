import express, { Router } from 'express';
import { FRENCH } from '../db.js';
import Account from '../models/Account.js';
import Transaction from '../models/Transaction.js';

const router = Router();

// Formats a browser can show as an <img>. No SVG: it can carry scripts.
export const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const LOGO_MAX_BYTES = 1024 * 1024;

const httpError = (status, message) => Object.assign(new Error(message), { status });

// Fields the client may set. The logo goes through /:id/logo, and the currency
// stays fixed: changing it would reinterpret every amount already recorded.
function editable(body) {
  const fields = {};
  for (const key of ['name', 'type', 'initialBalanceCents']) {
    if (body[key] !== undefined) fields[key] = body[key];
  }
  return fields;
}

// List accounts with their current balance
router.get('/', async (req, res) => {
  const accounts = await Account.find().sort({ name: 1 }).collation(FRENCH).lean();
  const totals = await Transaction.aggregate([
    { $group: { _id: '$account', totalCents: { $sum: '$amountCents' }, count: { $sum: 1 } } },
  ]);
  const totalByAccount = new Map(totals.map((t) => [String(t._id), t]));

  res.json(
    accounts.map((a) => {
      const total = totalByAccount.get(String(a._id));
      return {
        ...a,
        balanceCents: a.initialBalanceCents + (total?.totalCents ?? 0),
        transactionCount: total?.count ?? 0,
      };
    }),
  );
});

router.post('/', async (req, res) => {
  const account = await Account.create({ ...editable(req.body), currency: req.body.currency });
  res.status(201).json(account);
});

router.put('/:id', async (req, res) => {
  const account = await Account.findByIdAndUpdate(req.params.id, editable(req.body), {
    new: true,
    runValidators: true,
  });
  if (!account) return res.status(404).json({ error: 'Account not found' });
  res.json(account);
});

// Body: the image file itself (Content-Type: image/png, image/jpeg...)
router.put('/:id/logo', express.raw({ type: () => true, limit: LOGO_MAX_BYTES }), async (req, res) => {
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
});

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

// Moves every transaction of `from` into `to`, keeping the balance of `to` plus
// `from` unchanged. Transfers between the two accounts would become transfers
// from an account to itself: linked pairs cancel out and are deleted, a lone
// side becomes an ordinary transaction. Transfers with other accounts now
// point to `to`. Run before deleting `from`, so a failure leaves it in place.
async function moveTransactions(from, to) {
  const between = await Transaction.find(
    {
      $or: [
        { account: from._id, transferAccount: to._id },
        { account: to._id, transferAccount: from._id },
      ],
    },
    'transferPeer',
  ).lean();
  const ids = new Set(between.map((t) => String(t._id)));
  const paired = between.filter((t) => t.transferPeer && ids.has(String(t.transferPeer))).map((t) => t._id);
  await Transaction.deleteMany({ _id: { $in: paired } });
  await Transaction.updateMany(
    { _id: { $in: between.map((t) => t._id) } },
    { transferAccount: null, transferPeer: null },
  );

  await Transaction.updateMany({ transferAccount: from._id }, { transferAccount: to._id });
  await Transaction.updateMany({ account: from._id }, { account: to._id });
}

// Deletes the account. Its transactions are deleted with it, unless
// ?moveTo=<account id> moves them there (&moveInitialBalance=1 also adds its
// initial balance to that account's, so the total stays the same).
router.delete('/:id', async (req, res) => {
  const account = await Account.findById(req.params.id);
  if (!account) return res.status(404).json({ error: 'Account not found' });

  if (req.query.moveTo) {
    const target = await Account.findById(req.query.moveTo);
    if (!target) throw httpError(404, 'Compte de destination introuvable');
    if (target._id.equals(account._id)) throw httpError(400, 'Choisis un autre compte que celui à supprimer');
    if (target.currency !== account.currency) {
      throw httpError(400, `Le compte de destination doit être en ${account.currency}`);
    }
    await moveTransactions(account, target);
    await account.deleteOne();
    if (req.query.moveInitialBalance === '1') {
      await Account.updateOne({ _id: target._id }, { $inc: { initialBalanceCents: account.initialBalanceCents } });
    }
    return res.status(204).end();
  }

  const removed = await Transaction.find({ account: account._id }, '_id');
  await Transaction.deleteMany({ account: account._id });
  // Transfers from other accounts lose their link to the deleted side
  await Transaction.updateMany({ transferPeer: { $in: removed.map((t) => t._id) } }, { transferPeer: null });
  await Transaction.updateMany({ transferAccount: account._id }, { transferAccount: null });
  await account.deleteOne();
  res.status(204).end();
});

export default router;
