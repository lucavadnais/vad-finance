// Colors of groups and categories. A group has a color, and its categories are
// shown in shades of it; a category without a group has its own color.
import type { Category, CategoryGroup } from '@/types';

// Offered by the picker. Same palette as the backend, which draws one of the
// least used when the user picks none (backend/src/lib/colors.js).
export const PALETTE = [
  '#2a78d6',
  '#eb6834',
  '#1baf7a',
  '#eda100',
  '#e87ba4',
  '#008300',
  '#4a3aa7',
  '#e34948',
  '#843b40',
  '#ac48ad',
  '#0e9aa7',
  '#6b8e23',
  '#00a0e0',
  '#a0522d',
  '#3d5a80',
  '#b5179e',
];

// Gray for a category that cannot be found (e.g. deleted)
export const NO_COLOR = '#898781';

const toRgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (rgb: number[]) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

// `amount` < 0 darkens towards black, > 0 lightens towards white
function tint(hex: string, amount: number) {
  const target = amount < 0 ? 0 : 255;
  return toHex(toRgb(hex).map((v) => v + (target - v) * Math.abs(amount)));
}

// Shades of a group's color offered to its categories, from darkest to
// lightest; the color itself sits in the middle (index 4)
const SHADE_AMOUNTS = [-0.48, -0.36, -0.24, -0.12, 0, 0.15, 0.3, 0.45, 0.6];
export const BASE_SHADE = 4;

export const shadeScale = (hex: string) => SHADE_AMOUNTS.map((amount) => tint(hex, amount));

// Shades given to `count` categories without a picked one: the color itself
// for one, else spread between the 2nd and 8th shades, avoiding the `taken` ones
function autoShades(count: number, taken: Set<number>): number[] {
  const used = new Set(taken);
  return Array.from({ length: count }, (_, i) => {
    const wanted = count === 1 ? BASE_SHADE : Math.round(1 + (6 * i) / (count - 1));
    // Nearest free shade, or the wanted one when all are taken
    const free = [...SHADE_AMOUNTS.keys()]
      .filter((s) => !used.has(s))
      .sort((a, b) => Math.abs(a - wanted) - Math.abs(b - wanted))[0];
    const shade = free ?? wanted;
    used.add(shade);
    return shade;
  });
}

// Displayed color of each category, by id: in a group, the shade of the
// group's color it picked, or one spread automatically (in name order) among
// the others; without a group, its own color
export function categoryColors(categories: Category[], groups: CategoryGroup[]): Map<string, string> {
  const colors = new Map<string, string>();
  const groupById = new Map(groups.map((g) => [g._id, g]));
  const members = new Map<string, Category[]>();
  for (const c of categories) {
    const g = c.group ? groupById.get(c.group) : undefined;
    if (g) members.set(g._id, [...(members.get(g._id) ?? []), c]);
    else colors.set(c._id, c.color ?? NO_COLOR);
  }
  for (const [id, list] of members) {
    const scale = shadeScale(groupById.get(id)!.color ?? NO_COLOR);
    const picked = list.filter((c) => c.shade !== null && scale[c.shade] !== undefined);
    picked.forEach((c) => colors.set(c._id, scale[c.shade!]!));
    const auto = list.filter((c) => !picked.includes(c)).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    const spread = autoShades(auto.length, new Set(picked.map((c) => c.shade!)));
    auto.forEach((c, i) => colors.set(c._id, scale[spread[i]!]!));
  }
  return colors;
}
