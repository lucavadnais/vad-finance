import mongoose from 'mongoose';
import { ownedPlugin } from '../lib/owned.js';

// Each user's settings, a single document per user
const settingSchema = new mongoose.Schema(
  {
    // Kept aside each month for unplanned spending (a coffee...): it is
    // counted in the planned spending, and spending with no forecast or over
    // its category's forecast uses it before counting as an overrun
    budgetBufferCents: { type: Number, min: 0, default: 0, validate: Number.isInteger },
    // Charts show their axes (amounts on the left, first and last dates below)
    chartAxes: { type: Boolean, default: true },
  },
  { timestamps: true },
);

settingSchema.plugin(ownedPlugin);
// One per user (the plugin's index on `user`, made unique)
settingSchema.path('user').index({ unique: true });

const Setting = mongoose.model('Setting', settingSchema);
export default Setting;

// The user's settings document, created with the defaults the first time
export async function getSettings(user) {
  return Setting.findOneAndUpdate({ user }, {}, { upsert: true, new: true, setDefaultsOnInsert: true });
}
