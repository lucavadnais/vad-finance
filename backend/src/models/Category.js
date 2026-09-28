import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    kind: { type: String, enum: ['income', 'expense'], required: true },
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'CategoryGroup', default: null },
  },
  { timestamps: true },
);

export default mongoose.model('Category', categorySchema);
