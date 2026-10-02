// Projected expenses and amounts to receive, month by month. Everything is in cents.
import type { Projection } from '@/types';
import { formatDate } from '@/api';
import { RECURRENCES } from '@/lib/labels';

// A month, as its first day at midnight UTC (like the transactions' dates)
export type Month = { year: number; month: number }; // month: 0-11

export function currentMonth(now = new Date()): Month {
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() };
}

export function addMonths({ year, month }: Month, n: number): Month {
  const d = new Date(Date.UTC(year, month + n, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
}

export const sameMonth = (a: Month, b: Month) => a.year === b.year && a.month === b.month;

export function monthLabel({ year, month }: Month, style: 'long' | 'short' = 'long') {
  return new Date(Date.UTC(year, month, 1)).toLocaleDateString('fr-CA', {
    timeZone: 'UTC',
    month: style,
    year: 'numeric',
  });
}

const daysIn = ({ year, month }: Month) => new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

export function occursIn(p: Projection, m: Month) {
  if (p.recurrence === 'once') return p.month === m.month + 1 && p.year === m.year;
  if (p.recurrence === 'yearly' && p.month !== m.month + 1) return false;
  // Not past its end date
  return !p.endDate || Date.UTC(m.year, m.month, landingDay(p, m)) <= Date.parse(p.endDate);
}

// Its day, or the month's last day if shorter
const landingDay = (p: Projection, m: Month) => Math.min(p.dayOfMonth, daysIn(m));

export interface Occurrence {
  projection: Projection;
  // Day of the month it lands on: its day, or the month's last day if shorter
  day: number;
  // Positive for an amount to receive, negative for an expense
  signedCents: number;
}

// The projections falling in the month, by day then name
export function occurrences(projections: Projection[], m: Month): Occurrence[] {
  return projections
    .filter((p) => occursIn(p, m))
    .map((p) => ({
      projection: p,
      day: landingDay(p, m),
      signedCents: p.kind === 'expense' ? -p.amountCents : p.amountCents,
    }))
    .sort((a, b) => a.day - b.day || a.projection.name.localeCompare(b.projection.name, 'fr'));
}

export interface MonthTotals {
  expenseCents: number;
  incomeCents: number;
  netCents: number;
}

export function totals(list: Occurrence[]): MonthTotals {
  let expenseCents = 0;
  let incomeCents = 0;
  for (const o of list) {
    if (o.projection.kind === 'expense') expenseCents += o.projection.amountCents;
    else incomeCents += o.projection.amountCents;
  }
  return { expenseCents, incomeCents, netCents: incomeCents - expenseCents };
}

// "Chaque mois", "Chaque année · jusqu'au 2027-03-15"
export function recurrenceLabel(p: Projection) {
  const label = RECURRENCES[p.recurrence];
  return p.endDate && p.recurrence !== 'once' ? `${label} · jusqu'au ${formatDate(p.endDate)}` : label;
}
