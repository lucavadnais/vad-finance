// Aggregations behind the dashboard charts. Everything is in cents.
import type { Account, Category, CategoryGroup, Transaction } from '@/types';
import { NO_COLOR } from './colors';

export type Period = 'week' | 'month' | '6m' | '12m' | 'year' | 'all';

export const PERIODS: Record<Period, string> = {
  week: 'Cette semaine',
  month: 'Mois par mois',
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

// Categorical slots for the accounts, in the validated order (CSS variables in
// index.css). Categories have their own colors (lib/colors.ts).
const SLOTS = 10;
const slot = (i: number) => `var(--series-${i + 1})`;
const NONE_KEY = 'none';
// Series key of what is folded into "Autres" (accounts past the slots, small
// donut slices)
export const OTHER_KEY = 'other';

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
export const isExpense = (t: Transaction) => t.amountCents < 0 && !t.transferAccount;

export interface ExpenseSeries {
  series: Series[];
  // Series key a transaction's spending goes to
  keyOf: (t: Transaction) => string;
}

// Expense series, one per category - or per group of categories when `grouped`
// is on (categories without a group stay on their own) - spent on since
// `from`, by name. Each one wears its color: the category's displayed color
// (`colors`, see lib/colors.ts), or the group's. Uncategorized spending is gray.
export function expenseSeries(
  transactions: Transaction[],
  categories: Category[],
  groups: CategoryGroup[],
  colors: Map<string, string>,
  grouped: boolean,
  from: Date | null = null,
): ExpenseSeries {
  const groupById = new Map(groups.map((g) => [g._id, g]));
  const entityOf = new Map<string, Series>();
  for (const c of categories) {
    const g = grouped && c.group ? groupById.get(c.group) : undefined;
    entityOf.set(
      c._id,
      g
        ? { key: `group:${g._id}`, label: g.name, color: g.color ?? NO_COLOR }
        : { key: c._id, label: c.name, color: colors.get(c._id) ?? NO_COLOR },
    );
  }

  const present = new Map<string, Series>();
  let uncategorized = false;
  for (const t of transactions) {
    if (!isExpense(t) || (from && new Date(t.date) < from)) continue;
    const entity = t.category && entityOf.get(t.category._id);
    if (entity) present.set(entity.key, entity);
    else uncategorized = true;
  }

  const series = [...present.values()].sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  if (uncategorized) series.push({ key: NONE_KEY, label: 'Sans catégorie', color: 'var(--series-none)' });

  const keyOf = (t: Transaction) => (t.category && entityOf.get(t.category._id)?.key) || NONE_KEY;
  return { series, keyOf };
}

type Bucket = { key: string; label: string; t: number };

function monthBucket(d: Date): Bucket {
  const t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
  const label = new Date(t).toLocaleDateString('fr-CA', { timeZone: 'UTC', month: 'short', year: 'numeric' });
  return { key: String(t), label, t };
}

function dayBucket(d: Date): Bucket {
  const t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const label = new Date(t).toLocaleDateString('fr-CA', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });
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

export type Granularity = 'day' | 'week' | 'month';

// A clicked bar segment or donut slice: the series it stands for (several for
// a merged "Autres") and, for a bar, the day, week or month it covers
export interface ChartSelection {
  keys: string[];
  label: string;
  bucket?: number;
}

const BUCKETS = { day: dayBucket, week: weekBucket, month: monthBucket };

// Start (UTC ms) of the day, week or month a date falls in: the `t` of its row
export const bucketStart = (date: string | Date, granularity: Granularity) => BUCKETS[granularity](new Date(date)).t;

export const expensesByMonth = (tx: Transaction[], s: ExpenseSeries, from: Date | null, now = new Date()) =>
  expensesBy(monthBucket, (b) => addMonths(b, 1), tx, s, from, now);

export const expensesByDay = (tx: Transaction[], s: ExpenseSeries, from: Date | null, now = new Date()) =>
  expensesBy(dayBucket, (b) => addDays(b, 1), tx, s, from, now);

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
  const keyOf = (accountId: string | undefined) => (series.some((s) => s.key === accountId) ? accountId! : OTHER_KEY);

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
