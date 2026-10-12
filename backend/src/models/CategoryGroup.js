import mongoose from 'mongoose';
import { ownedPlugin } from '../lib/owned.js';

// Groups categories for the analysis and colors them, e.g. "Milieu de vie" = Électricité + Internet
const categoryGroupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // '#rrggbb': the group's categories are shown in shades of it (see
    // frontend/src/lib/colors.ts). Drawn by the route when none is picked.
    color: { type: String, match: /^#[0-9a-f]{6}$/i, lowercase: true, default: null },
  },
  { timestamps: true },
);

categoryGroupSchema.plugin(ownedPlugin);
categoryGroupSchema.index({ user: 1, name: 1 }, { unique: true });

export default mongoose.model('CategoryGroup', categoryGroupSchema);
