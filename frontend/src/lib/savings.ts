// Emergency fund: how much to keep aside (months of essential spending), where
// the user stands, and the pace they save at. General guidelines, the ones
// most Canadian banks give (Desjardins, BMO, RBC...): a starter cushion of
// about 1 000 $, then 3 to 6 months of essential spending, while saving about
// 20 % of the income. The fund and the user's own goals are virtual safes:
// money put aside stays in the accounts, and what is left is the free money.
import type { Account, Category, SavingsGoal, Transaction } from '@/types';
import type { Month } from './projections';
import { type Row, inTotal } from './chartData';
import { addMonths, currentMonth, sameMonth } from './projections';

// Months of essential spending to keep, by situation, from general guidelines
// published by banks and personal finance sites (`sources`), shown as a table
// to pick from in EmergencyFundDialog. Default: a stable income.
interface Source {
  label: string;
  url: string;
}

interface FundSituation {
  key: string;
  label: string;
  months: number;
  range: string;
  sources: Source[];
}

const DESJARDINS = {
  label: 'Desjardins',
  url: 'https://www.desjardins.com/fr/conseils/fonds-urgence-prevoir-imprevus.html',
};
const BMO = {
  label: 'BMO',
  url: 'https://www.bmo.com/fr-ca/principal/particuliers/comptes-bancaires/comptes-depargne/fonds-durgence/',
};
const RBC = {
  label: 'RBC',
  url: 'https://www.rbcroyalbank.com/fr-ca/mes-finances-dabord/endettement-et-reduction-du-stress/evenements-imprevus/fonds-durgence/votre-guide-complet-sur-les-fonds-durgence-combien-epargner-et-comment-en-constituer-un/',
};

export const FUND_SITUATIONS: FundSituation[] = [
  {
    key: 'couple',
    label: 'Couple, deux salaires stables',
    months: 3,
    range: '3 mois',
    sources: [DESJARDINS, { label: 'Wealthsimple', url: 'https://www.wealthsimple.com/fr-ca/learn/emergency-funds' }],
  },
  {
    key: 'single',
    label: 'Personne seule, salaire stable',
    months: 6,
    range: '3 à 6 mois',
    sources: [DESJARDINS, BMO],
  },
  {
    key: 'single-income',
    label: 'Famille avec un seul revenu, ou monoparentale',
    months: 6,
    range: '6 mois ou plus',
    sources: [BMO, RBC],
  },
  {
    key: 'variable',
    label: 'Travail autonome ou revenu variable',
    months: 9,
    range: '6 à 12 mois',
    sources: [
      { label: 'Protégez-vous', url: 'https://www.protegez-vous.ca/argent/fonds-d-urgence-investir' },
      {
        label: 'Éducfinance',
        url: 'https://educfinance.ca/articles/travailleur-autonome-5-strategies-pour-assurer-votre-securite-financiere',
      },
      { label: 'Earny', url: 'https://earny.ca/fonds-urgence/' },
    ],
  },
  {
    key: 'retired',
    label: "À la retraite, sans régime de retraite d'employeur",
    months: 6,
    range: '6 mois ou plus',
    sources: [{ label: 'FP Canada (Fund Library)', url: 'https://fundlibrary.com/fr/Articles/Detail/845' }],
  },
];

export const DEFAULT_FUND_MONTHS = 3;

// Owning a home: a share of its value kept for repairs, by its age - the low
// end of the yearly upkeep usually advised (1 % under 10 years, 1.5 to 2 % up
// to 25, 2 to 3 % beyond). Its age unknown: 1 %. Owning rental properties:
// 3 months of their expenses (3 to 6).
export const HOME_TIERS = [
  { maxAge: 10, share: 0.01, label: 'moins de 10 ans' },
  { maxAge: 25, share: 0.015, label: '10 à 25 ans' },
  { maxAge: Infinity, share: 0.02, label: '25 ans et plus' },
];

export function homeTier(builtYear: number | null, now = new Date()) {
  if (builtYear === null) return null;
  const age = now.getFullYear() - builtYear;
  return HOME_TIERS.find((t) => age < t.maxAge)!;
}

export const homeShare = (builtYear: number | null, now = new Date()) =>
  homeTier(builtYear, now)?.share ?? HOME_TIERS[0]!.share;

export const RENTAL_MONTHS = 3;
export const HOME_SOURCES: Source[] = [
  { label: 'Ratehub', url: 'https://ratehub.ca/blog/why-homeowners-need-an-emergency-fund' },
  {
    label: 'WealthNorth',
    url: 'https://wealthnorth.ca/mortgages/mortgage-payments/mortgage-budget-template-canada/',
  },
  {
    label: 'The Globe and Mail',
    url: 'https://theglobeandmail.com/investing/personal-finance/household-finances/article-in-search-of-hard-numbers-on-what-it-costs-to-maintain-a-home/',
  },
];
export const RENTAL_SOURCES: Source[] = [
  {
    label: 'Real Life Planning',
    url: 'https://reallifeplanning.com/blog/how-to-build-and-maintain-cash-reserves-for-your-rental-property',
  },
  {
    label: 'Addicted to ROI',
    url: 'https://addictedtoroi.com/blog/how-much-cash-reserve-should-you-keep-per-rental-property/',
  },
];

// The fund's target from its settings: its months of essential spending, plus
// a share of the home and months of rental expenses. While the essential
// spending is unknown, the owner's reserves alone; null without them either.
export function computedFundTarget(
  settings: { fundMonths: number; homeValueCents: number; homeBuiltYear: number | null; rentalExpensesCents: number },
  essentialMonthlyCents: number | null,
) {
  const reserves =
    Math.round(settings.homeValueCents * homeShare(settings.homeBuiltYear)) +
    settings.rentalExpensesCents * RENTAL_MONTHS;
  if (essentialMonthlyCents === null) return reserves > 0 ? reserves : null;
  return settings.fundMonths * essentialMonthlyCents + reserves;
}

// The fund's target: the amount picked, else the computed one
export const fundTarget = (fund: SavingsGoal, essentialMonthlyCents: number | null) =>
  fund.targetCents ?? computedFundTarget(fund, essentialMonthlyCents);
export const SAVINGS_RATE_TARGET = 0.2;

// Essential: its group ticked in `essentials` (the fund's), itself without one
function isEssential(c: Category, essentials: Set<string>) {
  return c.kind === 'expense' && essentials.has(c.group ?? c._id);
}

const monthOf = (date: string): Month => {
  const d = new Date(date);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
};
// A month as 'YYYY-MM', the way an ISO date (UTC, as the API sends them)
// starts: a transaction's month is its date's first 7 characters, no Date built
const monthKey = (m: Month) => `${m.year}-${String(m.month + 1).padStart(2, '0')}`;

// The full months before this one, `count` at most, from the first one with
// any transaction (the oldest first)
function pastMonths(transactions: Transaction[], count: number, now: Date) {
  if (transactions.length === 0) return [];
  const first = monthOf(transactions.reduce((a, t) => (t.date < a ? t.date : a), transactions[0]!.date));
  const start = Date.UTC(first.year, first.month, 1);
  const cur = currentMonth(now);
  return Array.from({ length: count }, (_, i) => addMonths(cur, i - count)).filter(
    (m) => Date.UTC(m.year, m.month, 1) >= start,
  );
}

const counted = (t: Transaction) => !t.transferAccount && !t.valuation;

// Months the essential spending's median is taken over
export const ESSENTIAL_MONTHS = 6;

// Essential spending of a usual month: the median of the last 6 full months
// (one unusual month does not pull it), refunds deducted. Null without a full
// month of history or without any essential category. `essentials`: the
// fund's, ids of groups or of categories without one.
export function essentialMonthly(
  transactions: Transaction[],
  categories: Category[],
  essentials: Iterable<string>,
  now = new Date(),
) {
  const ticked = new Set(essentials);
  const essential = new Set(categories.filter((c) => isEssential(c, ticked)).map((c) => c._id));
  const months = pastMonths(transactions, ESSENTIAL_MONTHS, now);
  if (essential.size === 0 || months.length === 0) return null;
  // One pass: each month's essential spending, by its key
  const byMonth = new Map(months.map((m) => [monthKey(m), 0]));
  for (const t of transactions) {
    if (!counted(t) || !t.category || !essential.has(t.category._id)) continue;
    const key = t.date.slice(0, 7);
    const sum = byMonth.get(key);
    if (sum !== undefined) byMonth.set(key, sum - t.amountCents);
  }
  const totals = [...byMonth.values()].sort((a, b) => a - b);
  const mid = totals.length >> 1;
  return Math.max(0, totals.length % 2 ? totals[mid]! : Math.round((totals[mid - 1]! + totals[mid]!) / 2));
}

// What the last 3 full months left over: per month on average, and as a share
// of the income (null without income). Income: positive amounts outside the
// expense categories; a refund in one lowers the spending instead.
export function savingsPace(transactions: Transaction[], now = new Date()) {
  const months = pastMonths(transactions, 3, now);
  if (months.length === 0) return null;
  const keys = new Set(months.map(monthKey));
  let income = 0;
  let net = 0;
  for (const t of transactions) {
    if (!counted(t) || !keys.has(t.date.slice(0, 7))) continue;
    net += t.amountCents;
    if (t.amountCents > 0 && t.category?.kind !== 'expense') income += t.amountCents;
  }
  return { monthlyCents: Math.round(net / months.length), rate: income > 0 ? net / income : null };
}

// What a goal holds: its account's balance (none below zero) when it has
// one, else the sum of its movements
export function goalHeldCents(goal: SavingsGoal, accounts: Account[]) {
  if (goal.account) return Math.max(0, accounts.find((a) => a._id === goal.account)?.balanceCents ?? 0);
  return goal.movements.reduce((sum, m) => sum + m.amountCents, 0);
}

// The money not set aside: the total of the accounts, less what the goals
// hold (an account of a goal counts only if it is in the total)
export function freeCents(accounts: Account[], goals: SavingsGoal[]) {
  const counted = inTotal(accounts);
  const total = counted.reduce((sum, a) => sum + a.balanceCents, 0);
  const held = goals
    .filter((g) => !g.account || counted.some((a) => a._id === g.account))
    .reduce((sum, g) => sum + goalHeldCents(g, accounts), 0);
  return total - held;
}

// Months from this one to the due date's, both included; 0 once past
export function monthsLeft(dueDate: string, now = new Date()) {
  const due = monthOf(dueDate);
  const cur = currentMonth(now);
  return Math.max(0, (due.year - cur.year) * 12 + due.month - cur.month + 1);
}

// What a goal with a date still needs each month to be reached in time.
// 'late' once its month is past; null without a date or once reached.
export function monthlyNeeded(targetCents: number, heldCents: number, dueDate: string | null, now = new Date()) {
  const left = targetCents - heldCents;
  if (!dueDate || left <= 0) return null;
  const months = monthsLeft(dueDate, now);
  return months === 0 ? 'late' : Math.ceil(left / months);
}

// Put aside in a goal this month, less what was taken back
export function heldThisMonth(goal: SavingsGoal, now = new Date()) {
  const cur = currentMonth(now);
  return goal.movements.filter((m) => sameMonth(monthOf(m.date), cur)).reduce((sum, m) => sum + m.amountCents, 0);
}

// Share of the time from the goal's creation to its due date already gone,
// 0 to 100
export function timeElapsed(goal: SavingsGoal, now = new Date()) {
  if (!goal.dueDate) return 0;
  const start = Date.parse(goal.createdAt);
  const span = Date.parse(goal.dueDate) - start;
  return span > 0 ? Math.min(100, Math.max(0, ((now.getTime() - start) / span) * 100)) : 100;
}

// "8 mois", "3 ans"
export const durationLabel = (months: number) => (months < 24 ? `${months} mois` : `${Math.floor(months / 12)} ans`);

// Money to take back from the goals when they keep more than the accounts
// hold (`freeCents` below zero, e.g. after a big expense): from the goals
// saved in the app, the newest first and the emergency fund last, each down
// to zero at most. `shortCents`: what is still over once they are all empty
// (only goals following an account left).
export function rebalancePlan(accounts: Account[], goals: SavingsGoal[]) {
  let over = -freeCents(accounts, goals);
  const plan: { goal: SavingsGoal; cents: number }[] = [];
  const order = [...goals.filter((g) => !g.emergency).reverse(), ...goals.filter((g) => g.emergency)];
  for (const goal of order) {
    if (over <= 0) break;
    if (goal.account) continue;
    const cents = Math.min(goalHeldCents(goal, accounts), over);
    if (cents <= 0) continue;
    plan.push({ goal, cents });
    over -= cents;
  }
  return { plan, shortCents: Math.max(0, over) };
}

// ---- Goals hidden from the total of the accounts (hiddenFromTotal): what a
// goal saved in the app held at each time is left out of the total's balance
// and curve. One following an account cannot be: that account has its own
// "excluded from the total".

const hidden = (goals: SavingsGoal[]) => goals.filter((g) => g.kind !== 'debt' && !g.account && g.hiddenFromTotal);

// What the hidden goals held at any time: their movements parsed and sorted
// once, summed as they go; `at(ms)` finds the last one by bisection
function hiddenHeld(goals: SavingsGoal[]) {
  const moves = hidden(goals)
    .flatMap((g) => g.movements.map((m) => ({ ms: Date.parse(m.date), cents: m.amountCents })))
    .sort((a, b) => a.ms - b.ms);
  const sums: number[] = [];
  let sum = 0;
  for (const m of moves) sums.push((sum += m.cents));
  return (ms: number) => {
    let lo = 0;
    let hi = moves.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (moves[mid]!.ms <= ms) lo = mid + 1;
      else hi = mid;
    }
    return lo === 0 ? 0 : sums[lo - 1]!;
  };
}

// The total of the accounts, the hidden goals left out
export const visibleTotal = (accounts: Account[], goals: SavingsGoal[]) =>
  inTotal(accounts).reduce((sum, a) => sum + a.balanceCents, 0) - hiddenHeld(goals)(Date.now());

// The total's curve (balanceOverTime), less what the hidden goals held at
// each point
export function withoutHidden(rows: Row[], goals: SavingsGoal[]): Row[] {
  const heldAt = hiddenHeld(goals);
  return rows.map((r) => ({ ...r, total: Number(r.total ?? 0) - heldAt(r.t) }));
}
