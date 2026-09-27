import mongoose from 'mongoose';

const accountSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['checking', 'savings', 'credit', 'investment', 'cash'],
      default: 'checking',
    },
    currency: { type: String, default: 'CAD', uppercase: true },
    // Amounts are stored in cents to avoid floating-point errors
    initialBalanceCents: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export default mongoose.model('Account', accountSchema);
