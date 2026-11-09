import mongoose from 'mongoose';
import { ownedPlugin } from '../lib/owned.js';

// A virtual safe: a share of the user's money kept for something (a trip, a
// car...), while it stays in their accounts. What it holds is the sum of its
// movements (money put aside, or taken back), or, with an account, that
// account's balance. Each user has one emergency fund, created with their
// first goals' list (routes/savingsGoals.js): its target is the amount the
// user picked, or is computed by the app from the spending on its essential
// expenses and the fields below (frontend/src/lib/savings.ts).
const movementSchema = new mongoose.Schema({
  // Positive = put aside, negative = taken back
  amountCents: { type: Number, required: true, validate: (v) => Number.isInteger(v) && v !== 0 },
  date: { type: Date, required: true },
  note: { type: String, trim: true, default: '' },
});

// A debt's interest rate for a period: yearly %, from this day (null = from
// the start) until the next rate's day
const rateSchema = new mongoose.Schema(
  {
    ratePercent: { type: Number, required: true, min: 0, max: 100 },
    from: { type: Date, default: null },
  },
  { _id: false },
);

// A debt's payment: the transactions of this account with this description
const paymentMatchSchema = new mongoose.Schema(
  {
    account: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
    description: { type: String, required: true, trim: true },
  },
  { _id: false },
);

// How often a debt's additional payments come back: every `interval` weeks,
// months or years
const extraRecurrenceSchema = new mongoose.Schema(
  {
    recurrence: { type: String, enum: ['weekly', 'monthly', 'yearly'], default: 'monthly' },
    interval: { type: Number, min: 1, max: 99, default: 1, validate: Number.isInteger },
  },
  { _id: false },
);

const savingsGoalSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    emergency: { type: Boolean, default: false },
    // 'debt': a loan paid off (student loan, mortgage...) instead of money put
    // aside. Its balance is not held in the accounts: it follows the payments
    // picked by the user (paymentMatches), each of them
    // lowering what is left from debtStartCents, interest deducted
    // (frontend/src/lib/debts.ts). Set at creation, never changed.
    kind: { type: String, enum: ['savings', 'debt'], default: 'savings', immutable: true },
    // Required for a savings goal but the emergency fund, where null =
    // computed by the app. A debt has none: it is paid off at zero.
    targetCents: {
      type: Number,
      min: 1,
      default: null,
      validate: (v) => v === null || Number.isInteger(v),
      required: function () {
        return this.kind !== 'debt' && !this.emergency;
      },
    },
    // Debt only: what was left to pay on debtStartDate (midnight UTC); the
    // payments after that day lower it
    debtStartCents: {
      type: Number,
      min: 1,
      default: null,
      validate: (v) => v === null || Number.isInteger(v),
      required: function () {
        return this.kind === 'debt';
      },
    },
    debtStartDate: {
      type: Date,
      default: null,
      required: function () {
        return this.kind === 'debt';
      },
    },
    // Debt only: the amount borrowed, when known: the progress starts from it
    // (null = the app works it out from the payments, frontend/src/lib/debts.ts)
    loanCents: {
      type: Number,
      min: 1,
      default: null,
      validate: (v) => v === null || Number.isInteger(v),
    },
    // Debt only: its yearly interest rates in %, e.g. 4.89, each from its
    // day (midnight UTC) until the next one's: a mortgage renewed at a new
    // rate, a variable rate that moved. The first one has no day (from the
    // start). None = no interest counted.
    interestRates: { type: [rateSchema], default: [] },
    // Debt only: the usual payment, picked from the transactions: by its
    // account and description (the app compares
    // them without digits, accents or case, so a reference number changing
    // each month still matches)
    paymentMatches: {
      type: [paymentMatchSchema],
      default: [],
      validate: function (v) {
        return this.kind !== 'debt' || v.length > 0;
      },
    },
    // Debt only: additional payments on top of the usual one, ticked among
    // the transactions; how often they come back (null = like the usual
    // payment, the app does not offer another yet); and how many were still
    // planned on extraCountFrom (null = until the end). In the end the app
    // foresees, they count while some are planned and none is late
    // (frontend/src/lib/debts.ts).
    extraRecurrence: { type: extraRecurrenceSchema, default: null },
    extraCount: {
      type: Number,
      min: 0,
      max: 9999,
      default: null,
      validate: (v) => v === null || Number.isInteger(v),
    },
    extraCountFrom: { type: Date, default: null },
    extraMatches: { type: [paymentMatchSchema], default: [] },
    // Debt only: prepayments, a large amount put on the debt once (before a
    // renewal...), each a transaction picked by the user
    prepayments: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' }], default: [] },
    // Emergency fund only, for its computed target: months of essential
    // spending, the value and age of the home owned (a share of it is kept
    // for repairs) and the monthly expenses of rental properties
    // The situation picked in the app's table (its key), null = months typed in
    fundSituation: { type: String, default: 'couple' },
    fundMonths: { type: Number, min: 1, max: 24, default: 3, validate: Number.isInteger },
    homeValueCents: { type: Number, min: 0, default: 0, validate: Number.isInteger },
    // The year the home was built: an older one needs a bigger share
    homeBuiltYear: {
      type: Number,
      min: 1600,
      max: 2200,
      default: null,
      validate: (v) => v === null || Number.isInteger(v),
    },
    rentalExpensesCents: { type: Number, min: 0, default: 0, validate: Number.isInteger },
    // Emergency fund only: the essential expenses, as ids of expense groups
    // (their categories follow them) and of categories without a group
    essentials: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    // Savings saved in the app only, the emergency fund too (no account: an
    // account has its own option): what it holds is left out of the total of the accounts (its
    // balance and curve, frontend/src/lib/savings.ts)
    hiddenFromTotal: { type: Boolean, default: false },
    // To reach by this day (midnight UTC), null = whenever
    dueDate: { type: Date, default: null },
    // The account saved on, whose balance is what the goal holds; changing
    // it clears the movements (routes/savingsGoals.js)
    account: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', default: null },
    movements: { type: [movementSchema], default: [] },
  },
  { timestamps: true },
);

savingsGoalSchema.plugin(ownedPlugin);
// One emergency fund per user
savingsGoalSchema.index({ user: 1, emergency: 1 }, { unique: true, partialFilterExpression: { emergency: true } });

savingsGoalSchema.virtual('heldCents').get(function () {
  return this.movements.reduce((sum, m) => sum + m.amountCents, 0);
});

export default mongoose.model('SavingsGoal', savingsGoalSchema);
