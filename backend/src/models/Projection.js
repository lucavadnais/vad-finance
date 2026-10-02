import mongoose from 'mongoose';

// A planned expense or an amount to receive, for the month-by-month projection.
// It lands on `startDate`, then, unless it happens once, every `interval` weeks,
// months or years after it (e.g. every 2 weeks for a pay every other Friday,
// every 3 months for a quarterly bill). Monthly and yearly ones keep the start
// date's day, or the month's last day if shorter (e.g. 31 in February). A
// repeating one stops after `endDate`, when set.
const projectionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // 'income' = an amount to receive (compte à recevoir)
    kind: { type: String, enum: ['income', 'expense'], required: true },
    // Always positive, in cents: the kind gives the direction
    amountCents: { type: Number, required: true, min: 0 },
    recurrence: { type: String, enum: ['once', 'weekly', 'monthly', 'yearly'], default: 'monthly' },
    // Every how many weeks, months or years
    interval: { type: Number, min: 1, max: 99, default: 1, validate: Number.isInteger },
    // First day it lands on (midnight UTC)
    startDate: { type: Date, required: true },
    // Last day a repeating projection can land on (midnight UTC), null = no end
    endDate: { type: Date, default: null },
    // Optional link to a category
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
  },
  { timestamps: true },
);

const Projection = mongoose.model('Projection', projectionSchema);
export default Projection;

// Projections saved before `startDate` had `dayOfMonth`, `month` and `year`
// instead: give them the start date those meant
export async function migrateProjections() {
  const old = await Projection.collection.find({ startDate: { $exists: false } }).toArray();
  const now = new Date();
  for (const p of old) {
    const year = p.year ?? now.getUTCFullYear();
    const month = (p.month ?? now.getUTCMonth() + 1) - 1;
    const day = Math.min(p.dayOfMonth ?? 1, new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
    await Projection.collection.updateOne(
      { _id: p._id },
      {
        $set: { startDate: new Date(Date.UTC(year, month, day)), interval: 1 },
        $unset: { dayOfMonth: '', month: '', year: '' },
      },
    );
  }
}
