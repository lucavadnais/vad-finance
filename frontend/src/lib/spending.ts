// Spending of a month day by day, the usual spending to compare it with, and
// the smooth curve the phone charts draw through it (SpendInsights, the home
// tiles' sparklines)
import type { Transaction } from '@/types';
import type { Month } from '@/lib/projections';
import { isExpense } from '@/lib/chartData';
import { addMonths } from '@/lib/projections';

export const daysIn = (m: Month) => new Date(Date.UTC(m.year, m.month + 1, 0)).getUTCDate();

// Spending of each day of a month (index 0 = the 1st), positive cents
export function dailySpending(transactions: Transaction[], m: Month) {
  const days = Array<number>(daysIn(m)).fill(0);
  for (const t of transactions) {
    if (!isExpense(t)) continue;
    const d = new Date(t.date);
    if (d.getUTCFullYear() === m.year && d.getUTCMonth() === m.month) days[d.getUTCDate() - 1]! -= t.amountCents;
  }
  return days;
}

export function runningTotal(values: number[]) {
  let sum = 0;
  return values.map((v) => (sum += v));
}

// The three months before `m`, from the first one with any transaction: the
// median running total of each day of `m` (a shorter month stays at its
// total), so one unusual month does not pull the line. Null with no history.
export function medianRunningTotal(transactions: Transaction[], m: Month) {
  const first = Math.min(...transactions.map((t) => Date.parse(t.date)));
  const months = [1, 2, 3].map((i) => addMonths(m, -i)).filter((p) => Date.UTC(p.year, p.month + 1, 1) > first);
  if (months.length === 0) return null;
  const totals = months.map((p) => runningTotal(dailySpending(transactions, p)));
  return Array.from({ length: daysIn(m) }, (_, d) => {
    const day = totals.map((t) => t[Math.min(d, t.length - 1)]!).sort((a, b) => a - b);
    const mid = day.length >> 1;
    return day.length % 2 ? day[mid]! : (day[mid - 1]! + day[mid]!) / 2;
  });
}

// How much more (positive) or less was spent than the usual, in percent;
// null with no usual to compare with
export const vsUsualPercent = (spentCents: number, usualCents: number | undefined) =>
  usualCents ? Math.round(((spentCents - usualCents) / usualCents) * 100) : null;

export type Point = readonly [x: number, y: number];

// SVG path of a smooth curve through the points that never overshoots them
// (monotone cubic, Fritsch-Carlson): a running total never seems to go down
// between two days
export function monotonePath(points: Point[]) {
  // Two values at the same x (a day's balance right at the start of the
  // period): the later one, or the slope between them would divide by zero
  const p = points.filter((pt, i) => i === points.length - 1 || points[i + 1]![0] !== pt[0]);
  if (p.length < 2) return '';
  const slope = (i: number) => (p[i + 1]![1] - p[i]![1]) / (p[i + 1]![0] - p[i]![0]);
  const tangents = p.map((_, i) => {
    if (i === 0) return slope(0);
    if (i === p.length - 1) return slope(i - 1);
    const a = slope(i - 1);
    const b = slope(i);
    return a * b <= 0 ? 0 : (3 * a * b) / (2 * Math.max(a, b) + Math.min(a, b)) || 0;
  });
  let d = `M${p[0]![0]},${p[0]![1]}`;
  for (let i = 0; i < p.length - 1; i++) {
    const [x0, y0] = p[i]!;
    const [x1, y1] = p[i + 1]!;
    const h = (x1 - x0) / 3;
    d += `C${x0 + h},${y0 + h * tangents[i]!} ${x1 - h},${y1 - h * tangents[i + 1]!} ${x1},${y1}`;
  }
  return d;
}
