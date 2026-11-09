// Debts (student loan, mortgage...): goals of kind 'debt' following the
// payments the user picked among their transactions (the usual one, the
// additional ones, prepayments). Each transaction with the same
// account and description (compared by paymentKey) after the day of the
// balance typed in lowers it, less the interest built up since the one
// before, at the rate of each period (InterestRate). The payments before that
// day are already in the balance: played backwards, they give what was owed
// before the first one found, where the progress starts from. No loan account needed:
// importing the statements is enough for it to update by itself.
import type { ExtraRecurrence, InterestRate, PaymentMatch, SavingsGoal, Transaction } from '@/types';
import { normalizeText } from './text';
import { currentMonth, sameMonth } from './projections';

const DAY = 86_400_000;
// A payment a month, when there are not two of them yet to tell the pace
const MONTH_DAYS = 365.25 / 12;
// Simulated payments at most when estimating the end: past it, never
const MAX_STEPS = 100 * 366;

// A description without what changes from one payment to the next (dates,
// reference numbers), accents, case or punctuation: "PRET 0423 / 2026-11" and
// "Prêt 0512 / 2026-12" are the same payment
export const paymentKey = (description: string) =>
  normalizeText(description)
    .replace(/[^a-z]+/g, ' ')
    .trim();

const isOutflow = (t: Transaction) => t.amountCents < 0 && !t.valuation && !!t.account;

// The payment a transaction is part of: its account and description
const matchOf = (t: Transaction) => candidateId(t.account!._id, t.description);

const idsOf = (matches: PaymentMatch[]) => new Set(matches.map((m) => candidateId(m.account, m.description)));

// The transactions paying the debt, the oldest first: the usual payment's,
// the additional ones' and the prepayments
export function debtPayments(goal: SavingsGoal, transactions: Transaction[]) {
  const ids = idsOf([...goal.paymentMatches, ...goal.extraMatches]);
  const prepaid = new Set(goal.prepayments);
  return transactions
    .filter((t) => isOutflow(t) && (ids.has(matchOf(t)) || prepaid.has(t._id)))
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
}

// A payment's pace from its transactions (the oldest first): the last amount,
// every median gap of the last 6 (a gap of 27 to 32 days is a month)
function seriesPace(series: Transaction[]) {
  const recent = series.slice(-6).map((t) => Date.parse(t.date));
  const gaps = recent.slice(1).map((ms, i) => (ms - recent[i]!) / DAY);
  const gap = gaps.length > 0 ? Math.max(1, median(gaps)) : MONTH_DAYS;
  return {
    amountCents: -series[series.length - 1]!.amountCents,
    intervalDays: gap >= 27 && gap <= 32 ? MONTH_DAYS : gap,
    lastMs: recent[recent.length - 1]!,
  };
}

// The usual payment's pace, from its transactions that come back (2 of them
// at least, and the last one not left behind): one alone keeps its own amount
// and rhythm, several add up by month; with none coming back yet, its latest
// one, once a month. Null amount without any. `lastMs`: its last
// transaction's day (null without any).
export function usualPace(paymentMatches: PaymentMatch[], transactions: Transaction[]) {
  const ids = idsOf(paymentMatches);
  const usual = transactions
    .filter((t) => isOutflow(t) && ids.has(matchOf(t)))
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  if (usual.length === 0) return { paymentCents: null, intervalDays: MONTH_DAYS, lastMs: null };
  const latestMs = Date.parse(usual[usual.length - 1]!.date);
  const recurring = paymentMatches
    .map((m) => usual.filter((t) => matchOf(t) === candidateId(m.account, m.description)))
    .filter((series) => series.length >= 2)
    .map(seriesPace)
    .filter((p) => latestMs - p.lastMs <= 2 * p.intervalDays * DAY);
  if (recurring.length === 0)
    return { paymentCents: -usual[usual.length - 1]!.amountCents, intervalDays: MONTH_DAYS, lastMs: latestMs };
  if (recurring.length === 1)
    return { paymentCents: recurring[0]!.amountCents, intervalDays: recurring[0]!.intervalDays, lastMs: latestMs };
  return {
    paymentCents: Math.round(recurring.reduce((sum, p) => sum + (p.amountCents * MONTH_DAYS) / p.intervalDays, 0)),
    intervalDays: MONTH_DAYS,
    lastMs: latestMs,
  };
}

// Days between two additional payments, by their own recurrence when set
const EVERY_DAYS: Record<ExtraRecurrence['recurrence'], number> = { weekly: 7, monthly: MONTH_DAYS, yearly: 365.25 };

// The additional payments' plan, from their transactions (null without any):
// - `amountCents`: one of them, what their transactions add up to over their
//   last period - the usual payment's (`usualDays`), or their own recurrence
//   when set (the app does not offer it yet);
// - `remaining`: how many are still planned - the number typed in, less
//   those come since (null = until the end);
// - `lastMs`: the last one's day, `lastPlannedMs` the day of the last one
//   planned (null = until the end);
// - `active`: whether they count in the end foreseen - some still planned,
//   and the next one not late (a period and a half without any, a week at
//   least).
export function extraPlan(
  plan: Pick<SavingsGoal, 'extraMatches' | 'extraRecurrence' | 'extraCount' | 'extraCountFrom'>,
  transactions: Transaction[],
  usualDays: number,
  now = new Date(),
) {
  const ids = idsOf(plan.extraMatches);
  const extras = transactions.filter((t) => isOutflow(t) && ids.has(matchOf(t)));
  if (extras.length === 0) return null;
  const r = plan.extraRecurrence;
  const periodDays = r ? EVERY_DAYS[r.recurrence] * r.interval : usualDays;
  const lastMs = Math.max(...extras.map((t) => Date.parse(t.date)));
  const amountCents = extras
    // The last period, a little short of it: the one before, a month back
    // to the day, is not in it
    .filter((t) => Date.parse(t.date) > lastMs - 0.8 * periodDays * DAY)
    .reduce((sum, t) => sum - t.amountCents, 0);
  const fromMs = plan.extraCountFrom ? Date.parse(plan.extraCountFrom) : 0;
  const remaining =
    plan.extraCount === null
      ? null
      : Math.max(0, plan.extraCount - extras.filter((t) => Date.parse(t.date) > fromMs).length);
  const late = now.getTime() > lastMs + (periodDays + Math.max(7, periodDays / 2)) * DAY;
  return {
    amountCents,
    periodDays,
    remaining,
    lastMs,
    lastPlannedMs: remaining === null ? null : lastMs + remaining * periodDays * DAY,
    active: !late && remaining !== 0,
  };
}

// The rate on day `ms`: the last one started by then (the first one has no
// day: from the start)
export function rateOn(rates: InterestRate[], ms: number) {
  let rate = 0;
  for (const r of rates) if (!r.from || Date.parse(r.from) <= ms) rate = r.ratePercent;
  return rate;
}

// Interest built up by `balanceCents` from `fromMs` to `toMs`, day by day at
// each period's rate (simple interest between two payments)
export function interestBetween(balanceCents: number, fromMs: number, toMs: number, rates: InterestRate[]) {
  if (toMs <= fromMs || balanceCents <= 0) return 0;
  // The days the rate changes on, within the span
  const cuts = rates
    .map((r) => (r.from ? Date.parse(r.from) : null))
    .filter((ms): ms is number => ms !== null && ms > fromMs && ms < toMs);
  const bounds = [fromMs, ...cuts, toMs];
  let interest = 0;
  for (let i = 0; i < bounds.length - 1; i++) {
    const days = (bounds[i + 1]! - bounds[i]!) / DAY;
    interest += (balanceCents * rateOn(rates, bounds[i]!) * days) / 36_500;
  }
  return interest;
}

export interface DebtStatus {
  // The amount borrowed when typed in, else what was owed just before the
  // first payment found (the balance typed in without any); and the first
  // payment's day (ms)
  originCents: number;
  originMs: number;
  // Left to pay after the last payment, and repaid since the origin
  // (interest left out)
  remainingCents: number;
  paidCents: number;
  // Interest paid since the origin
  interestCents: number;
  // The payments lowering it (after the balance's day), the newest first
  payments: Transaction[];
  // The usual payment and the days between two (usualPace)
  paymentCents: number | null;
  intervalDays: number;
  // The additional payments counted in the end foreseen (extraPlan): one of
  // them (0 when they do not count), and how many more (null = until the end)
  extraCents: number;
  extraRemaining: number | null;
  // Paid this month, all payments counted
  paidThisMonthCents: number;
  // Day it should be paid off at this pace (ms), null = never at this pace
  // or no payment yet
  payoffMs: number | null;
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
};

export function debtStatus(goal: SavingsGoal, transactions: Transaction[], now = new Date()): DebtStatus {
  const all = debtPayments(goal, transactions);
  const startMs = Date.parse(goal.debtStartDate ?? goal.createdAt);
  const startCents = goal.debtStartCents ?? 0;
  const rates = goal.interestRates;

  // The balance typed in is what a loan statement shows: the principal left
  // after the last payment by then, without the interest built up since. It
  // stands on that payment's day (the balance's own day without any).
  // A prepayment on the balance's own day comes after it: it is added on
  // purpose, once the balance is in
  const prepaid = new Set(goal.prepayments);
  const inBalance = (t: Transaction) => {
    const ms = Date.parse(t.date);
    return ms < startMs || (ms === startMs && !prepaid.has(t._id));
  };
  const before = all.filter(inBalance);
  const anchorMs = before.length > 0 ? Date.parse(before[before.length - 1]!.date) : startMs;

  // Back from it, through the payments it already counts: before each one,
  // what was left after it, less the interest built up until the next one,
  // plus the payment
  let interest = 0;
  let origin = startCents;
  let originMs = anchorMs;
  for (const t of [...before].reverse()) {
    const ms = Date.parse(t.date);
    const after = origin / (1 + interestBetween(1, ms, originMs, rates));
    interest += origin - after;
    origin = after - t.amountCents;
    originMs = ms;
  }

  // From the balance typed in, payment after payment, the interest running
  // from the last payment it counts
  let balance = startCents;
  let lastMs = anchorMs;
  const payments = all.filter((t) => !inBalance(t));
  for (const t of payments) {
    const ms = Date.parse(t.date);
    const due = interestBetween(balance, lastMs, ms, rates);
    interest += due;
    balance = balance + due + t.amountCents;
    lastMs = ms;
  }
  const remainingCents = Math.max(0, Math.round(balance));

  const { paymentCents, intervalDays } = usualPace(goal.paymentMatches, all);
  const extra = extraPlan(goal, all, intervalDays, now);
  // One additional payment, brought to the usual payment's rhythm
  const extraCents = extra?.active ? Math.round((extra.amountCents * intervalDays) / extra.periodDays) : 0;
  const extraRemaining = extra?.active ? extra.remaining : null;

  // The end, by playing the next payments forward from the last one: the
  // usual one, plus the additional one while some are still planned. A
  // prepayment lowers the balance, not the pace.
  let payoffMs: number | null = null;
  if (remainingCents === 0) payoffMs = payments.length ? lastMs : startMs;
  else if (paymentCents || extraCents) {
    let b = remainingCents;
    let ms = lastMs;
    for (let step = 0; step < MAX_STEPS && b > 0; step++) {
      const next = ms + intervalDays * DAY;
      const due = interestBetween(b, ms, next, rates);
      const pay = (paymentCents ?? 0) + (extraRemaining === null || step < extraRemaining ? extraCents : 0);
      // The payment does not even cover the interest: never paid off
      if (due >= pay) break;
      b = b + due - pay;
      ms = next;
    }
    if (b <= 0) payoffMs = ms;
  }

  const cur = currentMonth(now);
  const paidThisMonthCents = all
    .filter((t) => {
      const d = new Date(t.date);
      return sameMonth({ year: d.getUTCFullYear(), month: d.getUTCMonth() }, cur);
    })
    .reduce((sum, t) => sum - t.amountCents, 0);

  // The amount borrowed when typed in, else what was owed before the first
  // payment found
  const originCents = goal.loanCents ?? Math.round(origin);
  return {
    originCents,
    originMs,
    remainingCents,
    paidCents: Math.max(0, originCents - remainingCents),
    interestCents: Math.round(interest),
    payments: [...payments].reverse(),
    paymentCents,
    intervalDays,
    extraCents,
    extraRemaining,
    paidThisMonthCents,
    payoffMs,
  };
}

// Full months from this one to the one of `ms`
export function monthsUntil(ms: number, now = new Date()) {
  const d = new Date(ms);
  const cur = currentMonth(now);
  return Math.max(0, (d.getUTCFullYear() - cur.year) * 12 + d.getUTCMonth() - cur.month);
}

// "mars 2041"
export const monthLabel = (ms: number) =>
  new Date(ms).toLocaleDateString('fr-CA', { timeZone: 'UTC', month: 'long', year: 'numeric' });

// "tous les mois", "toutes les 2 semaines"...
export function paceLabel(intervalDays: number) {
  if (intervalDays < 10) return 'chaque semaine';
  if (intervalDays < 20) return 'toutes les 2 semaines';
  if (intervalDays < 45) return 'chaque mois';
  return `tous les ${Math.round(intervalDays / MONTH_DAYS)} mois`;
}

// The payments to pick from: the money out of each account, by description
// (paymentKey), the most recent first, with how many times it came up
export interface PaymentCandidate {
  // `${account}|${paymentKey}`
  id: string;
  latest: Transaction;
  count: number;
}

export function paymentCandidates(transactions: Transaction[]) {
  const byId = new Map<string, PaymentCandidate>();
  for (const t of transactions) {
    if (!isOutflow(t)) continue;
    const key = paymentKey(t.description);
    if (!key) continue;
    const id = `${t.account!._id}|${key}`;
    const found = byId.get(id);
    if (!found) byId.set(id, { id, latest: t, count: 1 });
    else {
      found.count++;
      if (t.date > found.latest.date) found.latest = t;
    }
  }
  return [...byId.values()].sort((a, b) => b.latest.date.localeCompare(a.latest.date));
}

export const candidateId = (account: string, description: string) => `${account}|${paymentKey(description)}`;
