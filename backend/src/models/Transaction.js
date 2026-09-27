import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
  {
    account: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    date: { type: Date, required: true, default: Date.now },
    description: { type: String, trim: true, default: '' },
    // Positive = income, negative = expense. Stored in cents.
    amountCents: { type: Number, required: true },
  },
  { timestamps: true },
);

transactionSchema.index({ account: 1, date: -1 });

export default mongoose.model('Transaction', transactionSchema);
