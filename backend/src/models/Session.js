import mongoose from 'mongoose';

// A signed-in browser. The cookie holds a random token; only its SHA-256 hash is
// stored, so reading the database is not enough to sign in as someone.
// Deleted by MongoDB once expired (TTL index), or at sign-out.
const sessionSchema = new mongoose.Schema(
  {
    _id: { type: String },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    expiresAt: { type: Date, required: true, expires: 0 },
  },
  { timestamps: true },
);

export default mongoose.model('Session', sessionSchema);
