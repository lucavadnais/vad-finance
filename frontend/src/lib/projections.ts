// Projected expenses and amounts to receive, month by month. Everything is in cents.
import type { Projection } from '@/types';
import { formatDate } from '@/api';
import { RECURRENCE_UNITS } from '@/lib/labels';

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

const DAY = 24 * 60 * 60 * 1000;

// Days of the month it lands on: none, one, or several for a weekly one
export function landingDays(p: Projection, m: Month): number[] {
  const start = new Date(p.startDate);
  const first = Date.UTC(m.year, m.month, 1);
  const last = Date.UTC(m.year, m.month, daysIn(m));
  const end = p.recurrence !== 'once' && p.endDate ? Date.parse(p.endDate) : Infinity;
  const days: number[] = [];

  if (p.recurrence === 'weekly') {
    // Every `interval` weeks from the start date, on the same weekday
    const step = 7 * p.interval * DAY;
    const t0 = start.getTime();
    let t = t0 >= first ? t0 : t0 + Math.ceil((first - t0) / step) * step;
    for (; t <= last && t <= end; t += step) days.push(new Date(t).getUTCDate());
    return days;
  }

  // Months from the start date's month to this one
  const elapsed = (m.year - start.getUTCFullYear()) * 12 + m.month - start.getUTCMonth();
  const period = p.recurrence === 'once' ? 0 : p.recurrence === 'yearly' ? 12 * p.interval : p.interval;
  const lands = period === 0 ? elapsed === 0 : elapsed >= 0 && elapsed % period === 0;
  if (!lands) return days;
  // The start date's day, or the month's last day if shorter
  const day = Math.min(start.getUTCDate(), daysIn(m));
  if (Date.UTC(m.year, m.month, day) <= end) days.push(day);
  return days;
}

// Next day it lands on from `from` (today), as 'YYYY-MM-DD', looking up to 10
// years ahead; null if it never lands again
export function nextDate(p: Projection, from = new Date()): string | null {
  const today = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  let m = currentMonth(from);
  for (let i = 0; i < 120; i++, m = addMonths(m, 1)) {
    const day = landingDays(p, m).find((d) => Date.UTC(m.year, m.month, d) >= today);
    if (day) return new Date(Date.UTC(m.year, m.month, day)).toISOString().slice(0, 10);
  }
  return null;
}

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
    .flatMap((p) =>
      landingDays(p, m).map((day) => ({
        projection: p,
        day,
        signedCents: p.kind === 'expense' ? -p.amountCents : p.amountCents,
      })),
    )
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

const weekday = (date: string) =>
  new Date(date).toLocaleDateString('fr-CA', { timeZone: 'UTC', weekday: 'long' });

// "Une seule fois", "Chaque mois", "Aux 2 semaines (vendredi)",
// "Aux 3 mois · jusqu'au 2027-03-15"
export function recurrenceLabel(p: Projection) {
  if (p.recurrence === 'once') return 'Une seule fois';
  const [one, many] = RECURRENCE_UNITS[p.recurrence];
  let label = p.interval === 1 ? `Chaque ${one}` : `Aux ${p.interval} ${many}`;
  if (p.recurrence === 'weekly') label += ` (${weekday(p.startDate)})`;
  return p.endDate ? `${label} · jusqu'au ${formatDate(p.endDate)}` : label;
}
