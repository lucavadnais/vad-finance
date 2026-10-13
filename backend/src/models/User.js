import mongoose from 'mongoose';

// A person signed in with Google. Their data (accounts, transactions...) points
// to this document's _id through its `user` field (see lib/owned.js).
const userSchema = new mongoose.Schema(
  {
    // Google's id for the account ("sub" of its ID token): never changes, unlike
    // the email
    googleSub: { type: String, required: true, unique: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    name: { type: String, trim: true, default: '' },
    // URL of the Google profile picture
    picture: { type: String, default: null },
  },
  { timestamps: true },
);

export default mongoose.model('User', userSchema);
