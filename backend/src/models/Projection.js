import mongoose from 'mongoose';

// A planned expense or an amount to receive, for the month-by-month projection.
// It lands on `dayOfMonth` (the month's last day if shorter, e.g. 31 in February):
// every month, every year in `month`, or once in `month` of `year`. A repeating
// one stops after `endDate`, when set.
const projectionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // 'income' = an amount to receive (compte à recevoir)
    kind: { type: String, enum: ['income', 'expense'], required: true },
    // Always positive, in cents: the kind gives the direction
    amountCents: { type: Number, required: true, min: 0 },
    dayOfMonth: { type: Number, required: true, min: 1, max: 31 },
    recurrence: { type: String, enum: ['monthly', 'yearly', 'once'], default: 'monthly' },
    // 1-12, for 'yearly' and 'once'
    month: {
      type: Number,
      min: 1,
      max: 12,
      default: null,
      required: function () {
        return this.recurrence !== 'monthly';
      },
    },
    // For 'once'
    year: {
      type: Number,
      default: null,
      required: function () {
        return this.recurrence === 'once';
      },
    },
    // Last day a repeating projection can land on (midnight UTC), null = no end
    endDate: { type: Date, default: null },
    // Optional link to a category
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
  },
  { timestamps: true },
);

export default mongoose.model('Projection', projectionSchema);
