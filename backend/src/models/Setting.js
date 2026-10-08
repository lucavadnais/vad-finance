import mongoose from 'mongoose';

// App settings, a single document for now (one per user once accounts exist)
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

const Setting = mongoose.model('Setting', settingSchema);
export default Setting;

// The settings document, created with the defaults the first time
export async function getSettings() {
  return (await Setting.findOne()) ?? (await Setting.create({}));
}
