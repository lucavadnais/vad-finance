import mongoose from 'mongoose';

const accountSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['checking', 'savings', 'credit', 'investment', 'cash'],
      default: 'checking',
    },
    // Image shown next to the account (bank logo...), served by
    // GET /api/accounts/:id/logo and never sent with the account itself
    logo: {
      type: { data: Buffer, contentType: String },
      select: false,
      default: undefined,
    },
    // Changes with each new logo: the frontend adds it to the logo URL so the
    // browser can cache the image forever
    logoUpdatedAt: { type: Date, default: null },
    currency: { type: String, default: 'CAD', uppercase: true },
    // Amounts are stored in cents to avoid floating-point errors
    initialBalanceCents: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.logo;
        return ret;
      },
    },
  },
);

export default mongoose.model('Account', accountSchema);
