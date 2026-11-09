import { Router } from 'express';
import Account from '../models/Account.js';
import SavingsGoal from '../models/SavingsGoal.js';
import Transaction from '../models/Transaction.js';

const router = Router();

const httpError = (status, message) => Object.assign(new Error(message), { status });

// An account follows one goal at most: two would each count its whole balance
async function checkAccountFree(user, account, goalId = null) {
  if (!account) return;
  const other = await SavingsGoal.findOne({ user, account, _id: { $ne: goalId } }, 'name').lean();
  if (other) throw httpError(409, `Ce compte est déjà associé à l'objectif « ${other.name} »`);
}

async function findGoal(req) {
  const goal = await SavingsGoal.findOne({ _id: req.params.id, user: req.userId });
  if (!goal) throw httpError(404, 'Objectif introuvable');
  return goal;
}

// The emergency fund first (created the first time), then the others in the
// order they were added
router.get('/', async (req, res) => {
  await SavingsGoal.updateOne(
    { user: req.userId, emergency: true },
    { $setOnInsert: { name: "Fonds d'urgence" } },
    { upsert: true },
  );
  res.json(await SavingsGoal.find({ user: req.userId }).sort({ emergency: -1, createdAt: 1 }));
});

// A debt's fields from the body: the payments followed, and the balance it
// starts from
async function debtFields(req) {
  const {
    debtStartCents,
    debtStartDate,
    loanCents = null,
    interestRates = [],
    paymentMatches = [],
    extraRecurrence = null,
    extraCount = null,
    extraMatches = [],
  } = req.body;
  if (!Array.isArray(paymentMatches) || paymentMatches.length === 0) {
    throw httpError(400, 'Choisissez au moins un paiement de cette dette');
  }
  for (const m of [...paymentMatches, ...extraMatches]) await Account.checkOwned(req.userId, m.account);
  // Kept in order, the one from the start first
  const rates = [...interestRates].sort(
    (a, b) => (a.from ? Date.parse(a.from) : 0) - (b.from ? Date.parse(b.from) : 0),
  );
  // The number planned counts from today: those come since lower it
  return {
    debtStartCents,
    debtStartDate,
    loanCents,
    interestRates: rates,
    paymentMatches,
    extraMatches,
    extraRecurrence,
    extraCount,
    extraCountFrom: extraCount === null ? null : new Date(),
  };
}

router.post('/', async (req, res) => {
  const { kind = 'savings', name } = req.body;
  if (kind === 'debt') {
    const goal = await SavingsGoal.create({ kind, name, ...(await debtFields(req)), user: req.userId });
    return res.status(201).json(goal);
  }
  const { targetCents, dueDate = null, account = null, hiddenFromTotal = false } = req.body;
  await Account.checkOwned(req.userId, account);
  await checkAccountFree(req.userId, account);
  // Hidden from the total: only a goal saved in the app, an account has its own option
  const hide = !account && !!hiddenFromTotal;
  const goal = await SavingsGoal.create({
    name,
    targetCents,
    dueDate,
    account,
    hiddenFromTotal: hide,
    user: req.userId,
  });
  res.status(201).json(goal);
});

// The whole goal is sent back by the form: replace it, so a removed date or
// account is cleared too. A new account (or none) starts the goal over: what
// was put aside in the app is dropped. The emergency fund keeps its name and has no date;
// its target is either picked (targetCents) or computed by the app from the
// fund fields.
router.put('/:id', async (req, res) => {
  const goal = await findGoal(req);
  if (goal.kind === 'debt') {
    goal.set({ name: req.body.name, ...(await debtFields(req)) });
    await goal.save();
    return res.json(goal);
  }
  const { name, targetCents = null, dueDate = null, account = null } = req.body;
  await Account.checkOwned(req.userId, account);
  await checkAccountFree(req.userId, account, goal._id);
  if (String(goal.account ?? '') !== String(account ?? '')) goal.movements = [];
  if (goal.emergency) {
    const {
      fundSituation = null,
      fundMonths = 3,
      homeValueCents = 0,
      homeBuiltYear = null,
      rentalExpensesCents = 0,
      essentials = [],
    } = req.body;
    goal.set({
      account,
      targetCents,
      fundSituation,
      fundMonths,
      homeValueCents,
      homeBuiltYear,
      rentalExpensesCents,
      essentials,
      // Saved in the app only: an account has its own option
      hiddenFromTotal: !account && !!req.body.hiddenFromTotal,
    });
  } else goal.set({ name, targetCents, dueDate, account, hiddenFromTotal: !account && !!req.body.hiddenFromTotal });
  await goal.save();
  res.json(goal);
});

// A debt's prepayment: one of the user's transactions, counted once
router.post('/:id/prepayments', async (req, res) => {
  const goal = await findGoal(req);
  if (goal.kind !== 'debt') throw httpError(400, 'Seule une dette reçoit des paiements anticipés');
  const found = await Transaction.exists({ _id: req.body.transaction, user: req.userId });
  if (!found) throw httpError(404, 'Transaction introuvable');
  goal.prepayments.addToSet(req.body.transaction);
  await goal.save();
  res.status(201).json(goal);
});

router.delete('/:id/prepayments/:transactionId', async (req, res) => {
  const goal = await findGoal(req);
  goal.prepayments.pull(req.params.transactionId);
  await goal.save();
  res.json(goal);
});

router.delete('/:id', async (req, res) => {
  const goal = await findGoal(req);
  if (goal.emergency) throw httpError(400, "Le fonds d'urgence ne peut pas être supprimé");
  await SavingsGoal.deleteOne({ _id: goal._id, user: req.userId });
  res.status(204).end();
});

// Money put aside (amountCents > 0) or taken back (< 0). Never more taken
// back than the goal holds. Whether it stays under the total of the accounts
// is checked by the app, which knows the balances.
router.post('/:id/movements', async (req, res) => {
  const goal = await findGoal(req);
  if (goal.kind === 'debt') throw httpError(400, 'Une dette suit ses paiements : rien à mettre de côté');
  if (goal.account) throw httpError(400, "Cet objectif suit le solde d'un compte");
  const { amountCents, date, note = '' } = req.body;
  if (goal.heldCents + Number(amountCents) < 0) {
    throw httpError(400, 'Vous ne pouvez pas retirer plus que ce que contient cet objectif');
  }
  goal.movements.push({ amountCents, date, note });
  await goal.save();
  res.status(201).json(goal);
});

router.delete('/:id/movements/:movementId', async (req, res) => {
  const goal = await findGoal(req);
  const movement = goal.movements.id(req.params.movementId);
  if (!movement) throw httpError(404, 'Mouvement introuvable');
  if (goal.heldCents - movement.amountCents < 0) {
    throw httpError(
      409,
      "Sans ce dépôt, l'objectif serait à découvert : supprimez d'abord les retraits qui le suivent",
    );
  }
  movement.deleteOne();
  await goal.save();
  res.json(goal);
});

export default router;
