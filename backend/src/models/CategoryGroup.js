import mongoose from 'mongoose';

// Groups categories for the analysis and colors them, e.g. "Milieu de vie" = Électricité + Internet
const categoryGroupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    // '#rrggbb': the group's categories are shown in shades of it (see
    // frontend/src/lib/colors.ts). Drawn by the route when none is picked.
    color: { type: String, match: /^#[0-9a-f]{6}$/i, lowercase: true, default: null },
  },
  { timestamps: true },
);

export default mongoose.model('CategoryGroup', categoryGroupSchema);
