import mongoose from 'mongoose';

// Groups categories for the analysis, e.g. "Milieu de vie" = Électricité + Internet
const categoryGroupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
  },
  { timestamps: true },
);

export default mongoose.model('CategoryGroup', categoryGroupSchema);
