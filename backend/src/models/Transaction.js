import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
  {
    account: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    date: { type: Date, required: true, default: Date.now },
    description: { type: String, trim: true, default: '' },
    // Positive = income, negative = expense. Stored in cents.
    amountCents: { type: Number, required: true },
    // Transfers between own accounts (see lib/transfers.js): the account on the
    // other side, and the matching transaction there once both sides are linked
    transferAccount: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', default: null },
    transferPeer: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', default: null },
    // Set when the user dismissed a suggested pair, so it is not suggested again
    transferIgnored: { type: Boolean, default: false },
    // Transactions the user said this one is not a duplicate of (lib/duplicates.js)
    duplicateIgnored: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' }],
  },
  { timestamps: true },
);

transactionSchema.index({ account: 1, date: -1 });
// Transactions table: newest first, paginated
transactionSchema.index({ date: -1, _id: -1 });

export default mongoose.model('Transaction', transactionSchema);
