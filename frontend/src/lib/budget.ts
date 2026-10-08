// Planned vs actual, by category, for one month. Everything is in cents and
// positive: an expense row adds up money going out, an income row money coming in.
import type { Category, CategoryKind, Projection, Transaction } from '@/types';
import type { Month } from './projections';
import { occurrences, sameMonth } from './projections';

// One forecast inside a row, with the days it lands on this month
export interface BudgetForecast {
  projection: Projection;
  days: number[];
  cents: number;
}

export interface BudgetRow {
  key: string;
  label: string;
  kind: CategoryKind;
  plannedCents: number;
  // Part of the forecast due by today: all of it for a past month, none for a
  // future one. The gap is measured against it, so a pay still to come this
  // month does not show as missing.
  dueCents: number;
  actualCents: number;
  // The forecasts adding up to plannedCents
  forecasts: BudgetForecast[];
  // Forecasts without a category: nothing to compare them with
  uncategorized?: boolean;
}

export interface Budget {
  expense: BudgetRow[];
  income: BudgetRow[];
}

const UNCATEGORIZED = 'none';

function monthOf(date: string): Month {
  const d = new Date(date);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
}

export function budget(
  projections: Projection[],
  transactions: Transaction[],
  categories: Category[],
  m: Month,
  now = new Date(),
): Budget {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const byCategory = new Map(categories.map((c) => [c._id, c]));
  const rows = new Map<string, BudgetRow>();
  const row = (key: string, init: () => Omit<BudgetRow, 'plannedCents' | 'dueCents' | 'actualCents' | 'forecasts'>) => {
    let r = rows.get(key);
    if (!r) rows.set(key, (r = { ...init(), plannedCents: 0, dueCents: 0, actualCents: 0, forecasts: [] }));
    return r;
  };

  for (const o of occurrences(projections, m)) {
    const p = o.projection;
    const category = p.category ? byCategory.get(p.category) : undefined;
    const r = category
      ? row(category._id, () => ({ key: category._id, label: category.name, kind: category.kind }))
      : // One row per forecast: they cannot be compared, list them so they can be linked
        row(`projection:${p._id}`, () => ({
          key: `projection:${p._id}`,
          label: p.name,
          kind: p.kind,
          uncategorized: true,
        }));
    r.plannedCents += p.amountCents;
    const forecast = r.forecasts.find((f) => f.projection._id === p._id);
    if (forecast) {
      forecast.days.push(o.day);
      forecast.cents += p.amountCents;
    } else r.forecasts.push({ projection: p, days: [o.day], cents: p.amountCents });
    if (Date.UTC(m.year, m.month, o.day) <= today) r.dueCents += p.amountCents;
  }

  for (const t of transactions) {
    // Transfers move money between own accounts: neither spent nor earned
    if (t.transferAccount || !sameMonth(monthOf(t.date), m)) continue;
    const category = t.category ? byCategory.get(t.category._id) : undefined;
    // Uncategorized transactions: their sign says expense or income
    const kind: CategoryKind = category?.kind ?? (t.amountCents < 0 ? 'expense' : 'income');
    const key = category?._id ?? `${UNCATEGORIZED}:${kind}`;
    const r = row(key, () => ({ key, label: category?.name ?? 'Sans catégorie', kind }));
    // A refund lowers the spending of its category, a reversal the income
    r.actualCents += kind === 'expense' ? -t.amountCents : t.amountCents;
  }

  // Compared rows first, biggest forecast first; then actual-only, then forecast-only
  const order = (a: BudgetRow, b: BudgetRow) =>
    Number(!!a.uncategorized) - Number(!!b.uncategorized) ||
    Number(a.plannedCents === 0) - Number(b.plannedCents === 0) ||
    b.plannedCents - a.plannedCents ||
    b.actualCents - a.actualCents;
  const all = [...rows.values()].sort(order);
  return { expense: all.filter((r) => r.kind === 'expense'), income: all.filter((r) => r.kind === 'income') };
}

export function sum(rows: BudgetRow[]) {
  let plannedCents = 0;
  let dueCents = 0;
  let actualCents = 0;
  for (const r of rows) {
    plannedCents += r.plannedCents;
    dueCents += r.dueCents;
    actualCents += r.actualCents;
  }
  return { plannedCents, dueCents, actualCents };
}

// Section summary, added up category by category (a net total would let an
// overrun in one category hide behind a bill not charged yet in another):
// - leftCents: forecast not reached yet (still to spend, or to receive)
// - lateCents: part of it already due by today (shown for income: not received)
// - extraCents: above the forecasts, plus everything with no forecast
function summarize(compared: BudgetRow[], unplannedCents: number) {
  let leftCents = 0;
  let lateCents = 0;
  let extraCents = unplannedCents;
  for (const r of compared) {
    leftCents += Math.max(0, r.plannedCents - r.actualCents);
    lateCents += Math.max(0, r.dueCents - r.actualCents);
    extraCents += Math.max(0, r.actualCents - r.plannedCents);
  }
  return { leftCents, lateCents, extraCents };
}

// One side of the budget (income or spending) summed up the way the budget
// card shows it: compared rows, then the categories with no forecast (folded),
// then the forecasts with no category (nothing to compare them with). For
// spending, the monthly buffer is planned too, and absorbs what goes over the
// forecasts (or has none) before it counts as an overrun.
export function budgetSection(rows: BudgetRow[], bufferCents = 0) {
  const compared = rows.filter((r) => !r.uncategorized && r.plannedCents > 0);
  const unplanned = rows.filter((r) => !r.uncategorized && r.plannedCents === 0);
  const uncategorized = rows.filter((r) => r.uncategorized);
  const unplannedCents = sum(unplanned).actualCents;
  const summary = summarize(compared, unplannedCents);
  const bufferUsedCents = Math.min(summary.extraCents, bufferCents);
  const total = sum(rows);
  return {
    compared,
    unplanned,
    uncategorized,
    unplannedCents,
    // Every forecast counts in the planned total, like in the net
    total: { ...total, plannedCents: total.plannedCents + bufferCents },
    summary: { ...summary, bufferCents, bufferUsedCents, overrunCents: summary.extraCents - bufferUsedCents },
  };
}
