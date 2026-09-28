// Aggregations behind the dashboard charts. Everything is in cents.
import type { Account, Category, CategoryGroup, Transaction } from '@/types';

export type Period = 'week' | 'month' | '6m' | '12m' | 'year' | 'all';

export const PERIODS: Record<Period, string> = {
  week: 'Cette semaine',
  month: 'Ce mois-ci',
  '6m': '6 derniers mois',
  '12m': '12 derniers mois',
  year: 'Cette année',
  all: 'Tout',
};

export interface Series {
  key: string;
  label: string;
  color: string;
}

// A row per bucket (week, month, date) with one numeric column per series key
export type Row = { label: string; t: number } & Record<string, number | string>;

// Categorical slots, in the validated order (CSS variables in index.css)
const SLOTS = 8;
const slot = (i: number) => `var(--series-${i + 1})`;
const NONE_KEY = 'none';
const OTHER_KEY = 'other';

// First day (UTC) of the period, or null for all time
export function periodStart(period: Period, now = new Date()): Date | null {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  // Weeks start on Monday, like the weekly chart
  if (period === 'week') return new Date(Date.UTC(y, m, now.getUTCDate() - ((now.getUTCDay() + 6) % 7)));
  if (period === 'month') return new Date(Date.UTC(y, m, 1));
  if (period === '6m') return new Date(Date.UTC(y, m - 5, 1));
  if (period === '12m') return new Date(Date.UTC(y, m - 11, 1));
  if (period === 'year') return new Date(Date.UTC(y, 0, 1));
  return null;
}

// Spending = money out, except transfers between own accounts (paying the
// credit card from the checking account is not an expense: the card purchases are)
const isExpense = (t: Transaction) => t.amountCents < 0 && !t.transferAccount;

// What a category is counted under: itself, or its group when grouping is on
interface Entity {
  key: string;
  label: string;
}

export interface ExpenseSeries {
  series: Series[];
  // Series key a transaction's spending goes to
  keyOf: (t: Transaction) => string;
}

// Expense series, one per category - or per group of categories when `grouped`
// is on (categories without a group stay on their own). Colors follow the
// entity, not the period: the entities with the most spending over all time get
// the slots (ordered by name), the tail folds into "Autres", and uncategorized
// spending is gray.
export function expenseSeries(
  transactions: Transaction[],
  categories: Category[],
  groups: CategoryGroup[],
  grouped: boolean,
): ExpenseSeries {
  const groupById = new Map(groups.map((g) => [g._id, g]));
  const entityOf = new Map<string, Entity>();
  for (const c of categories) {
    const g = grouped && c.group ? groupById.get(c.group) : undefined;
    entityOf.set(c._id, g ? { key: `group:${g._id}`, label: g.name } : { key: c._id, label: c.name });
  }

  const spent = new Map<string, number>();
  const entities = new Map<string, Entity>();
  let uncategorized = false;
  for (const t of transactions) {
    if (!isExpense(t)) continue;
    const entity = t.category && entityOf.get(t.category._id);
    if (!entity) {
      uncategorized = true;
      continue;
    }
    entities.set(entity.key, entity);
    spent.set(entity.key, (spent.get(entity.key) ?? 0) - t.amountCents);
  }

  const used = [...entities.values()];
  const keep = used.length > SLOTS ? SLOTS - 1 : SLOTS;
  const top = used
    .sort((a, b) => spent.get(b.key)! - spent.get(a.key)!)
    .slice(0, keep)
    .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  const kept = new Set(top.map((e) => e.key));

  const series: Series[] = top.map((e, i) => ({ ...e, color: slot(i) }));
  if (used.length > keep) series.push({ key: OTHER_KEY, label: 'Autres', color: 'var(--series-other)' });
  if (uncategorized) series.push({ key: NONE_KEY, label: 'Sans catégorie', color: 'var(--series-none)' });

  const keyOf = (t: Transaction) => {
    const entity = t.category && entityOf.get(t.category._id);
    if (!entity) return NONE_KEY;
    return kept.has(entity.key) ? entity.key : OTHER_KEY;
  };
  return { series, keyOf };
}

type Bucket = { key: string; label: string; t: number };

function monthBucket(d: Date): Bucket {
  const t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
  const label = new Date(t).toLocaleDateString('fr-CA', { timeZone: 'UTC', month: 'short', year: '2-digit' });
  return { key: String(t), label, t };
}

// Weeks start on Monday
function weekBucket(d: Date): Bucket {
  const day = (d.getUTCDay() + 6) % 7;
  const t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day);
  const label = `Semaine du ${new Date(t).toLocaleDateString('fr-CA', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })}`;
  return { key: String(t), label, t };
}

const addMonths = (b: Bucket, n: number) => {
  const d = new Date(b.t);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
};
const addDays = (b: Bucket, n: number) => new Date(b.t + n * 86_400_000);

// Spending per bucket and series. Empty buckets between the first and last
// ones are kept so gaps in time stay visible.
function expensesBy(
  make: (d: Date) => Bucket,
  next: (b: Bucket) => Date,
  transactions: Transaction[],
  { series, keyOf }: ExpenseSeries,
  from: Date | null,
  now: Date,
): Row[] {
  const expenses = transactions.filter((t) => isExpense(t) && (!from || new Date(t.date) >= from));
  if (expenses.length === 0) return [];

  const rows = new Map<string, Row>();
  const empty = (b: Bucket): Row => ({
    label: b.label,
    t: b.t,
    ...Object.fromEntries(series.map((s) => [s.key, 0])),
  });

  const first = from ? make(from) : make(new Date(Math.min(...expenses.map((t) => Date.parse(t.date)))));
  const last = make(now);
  for (let b = first; b.t <= last.t; b = make(next(b))) rows.set(b.key, empty(b));

  for (const t of expenses) {
    const row = rows.get(make(new Date(t.date)).key);
    if (!row) continue; // dated in the future
    const key = keyOf(t);
    row[key] = (row[key] as number) - t.amountCents;
  }
  return [...rows.values()];
}

export const expensesByMonth = (tx: Transaction[], s: ExpenseSeries, from: Date | null, now = new Date()) =>
  expensesBy(monthBucket, (b) => addMonths(b, 1), tx, s, from, now);

export const expensesByWeek = (tx: Transaction[], s: ExpenseSeries, from: Date | null, now = new Date()) =>
  expensesBy(weekBucket, (b) => addDays(b, 7), tx, s, from, now);

// One series per account (tail folded past the slot count), ordered by name
export function accountSeries(accounts: Account[]): Series[] {
  const sorted = [...accounts].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  const keep = sorted.length > SLOTS ? SLOTS - 1 : SLOTS;
  const series: Series[] = sorted.slice(0, keep).map((a, i) => ({ key: a._id, label: a.name, color: slot(i) }));
  if (sorted.length > keep) series.push({ key: OTHER_KEY, label: 'Autres comptes', color: 'var(--series-other)' });
  return series;
}

export const TOTAL_SERIES: Series = { key: 'total', label: 'Total', color: 'var(--series-1)' };

// Balance after each day with transactions, per account and in total. Starts
// at the balance on the first day of the period and ends today.
export function balanceOverTime(
  transactions: Transaction[],
  accounts: Account[],
  series: Series[],
  from: Date | null,
  now = new Date(),
): Row[] {
  const keyOf = (accountId: string | undefined) =>
    series.some((s) => s.key === accountId) ? accountId! : OTHER_KEY;

  const balance = new Map<string, number>(series.map((s) => [s.key, 0]));
  const add = (accountId: string | undefined, cents: number) => {
    const key = keyOf(accountId);
    if (balance.has(key)) balance.set(key, balance.get(key)! + cents);
  };
  for (const a of accounts) add(a._id, a.initialBalanceCents);

  const sorted = [...transactions].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  const snapshot = (t: number): Row => {
    const values = Object.fromEntries(balance);
    const total = [...balance.values()].reduce((sum, v) => sum + v, 0);
    return { label: '', t, ...values, total };
  };

  const rows: Row[] = [];
  let i = 0;
  // Everything before the period only sets the starting balance
  if (from) {
    for (; i < sorted.length && Date.parse(sorted[i].date) < from.getTime(); i++) {
      add(sorted[i].account?._id, sorted[i].amountCents);
    }
    rows.push(snapshot(from.getTime()));
  }
  for (; i < sorted.length; i++) {
    const t = Date.parse(sorted[i].date);
    add(sorted[i].account?._id, sorted[i].amountCents);
    const next = sorted[i + 1];
    if (!next || Date.parse(next.date) !== t) rows.push(snapshot(t));
  }
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (rows.length > 0 && rows[rows.length - 1].t < today) rows.push(snapshot(today));
  return rows;
}
