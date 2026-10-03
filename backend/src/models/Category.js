import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    kind: { type: String, enum: ['income', 'expense'], required: true },
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'CategoryGroup', default: null },
    // '#rrggbb', used for the category everywhere (charts, badges). Set by the
    // route when the user picks none (see lib/colors.js)
    color: { type: String, match: /^#[0-9a-f]{6}$/i, lowercase: true, default: null },
    // In a group: the shade of the group's color picked by the user, from 0
    // (darkest) to 8 (lightest); null = spread automatically
    // Archived: kept on its past transactions, no longer offered as a choice
    archived: { type: Boolean, default: false },
    shade: { type: Number, min: 0, max: 8, validate: (v) => v === null || Number.isInteger(v), default: null },
  },
  { timestamps: true },
);

export default mongoose.model('Category', categorySchema);
