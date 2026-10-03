// Colors of category groups, and of the categories without a group (a
// category in a group is shown in a shade of the group's color). One created
// without a color gets one drawn at random among the palette's least used, so
// they stay apart in the charts. Same palette as the color picker
// (frontend/src/lib/colors.ts).
import Category from '../models/Category.js';
import CategoryGroup from '../models/CategoryGroup.js';

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

export const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

// `used`: colors already taken (one entry per category)
export function pickColor(used) {
  const count = new Map(PALETTE.map((c) => [c, 0]));
  for (const c of used) {
    const key = c?.toLowerCase();
    if (count.has(key)) count.set(key, count.get(key) + 1);
  }
  const least = Math.min(...count.values());
  const candidates = PALETTE.filter((c) => count.get(c) === least);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// Colors seen in the charts: the groups', and the categories' without a group.
// `except`: the category or group being recolored.
export async function usedColors(except = null) {
  const notSelf = except ? { _id: { $ne: except } } : {};
  const [groups, categories] = await Promise.all([
    CategoryGroup.find({ ...notSelf, color: { $ne: null } }, 'color').lean(),
    Category.find({ ...notSelf, group: null, color: { $ne: null } }, 'color').lean(),
  ]);
  return [...groups, ...categories].map((d) => d.color);
}

// Groups and categories saved before colors existed get one each
export async function migrateColors() {
  const noColor = { $or: [{ color: null }, { color: { $exists: false } }] };
  const used = await usedColors();
  for (const Model of [CategoryGroup, Category]) {
    for (const d of await Model.find(noColor, '_id group')) {
      const color = pickColor(used);
      // A category in a group shows a shade of the group's color, not its own
      if (!d.group) used.push(color);
      await Model.updateOne({ _id: d._id }, { color });
    }
  }
}
