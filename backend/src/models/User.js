import mongoose from 'mongoose';

// A person signed in with Google. Their data (accounts, transactions...) points
// to this document's _id through its `user` field (see lib/owned.js).
const userSchema = new mongoose.Schema(
  {
    // Google's id for the account ("sub" of its ID token): never changes, unlike
    // the email. Null for a user created by scripts/migrate-to-users.js until
    // their first sign-in, which links them by email.
    googleSub: { type: String, default: null },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    name: { type: String, trim: true, default: '' },
    // URL of the Google profile picture
    picture: { type: String, default: null },
  },
  { timestamps: true },
);

userSchema.index({ googleSub: 1 }, { unique: true, partialFilterExpression: { googleSub: { $type: 'string' } } });

export default mongoose.model('User', userSchema);
