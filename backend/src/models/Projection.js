import mongoose from 'mongoose';
import { ownedPlugin } from '../lib/owned.js';

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

projectionSchema.plugin(ownedPlugin);

const Projection = mongoose.model('Projection', projectionSchema);
export default Projection;

