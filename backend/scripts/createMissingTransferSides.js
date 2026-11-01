// One-off fix for transfers recorded before the app created missing sides
// (lib/transfers.js): each transfer without its other side gets linked to a
// matching row already in the other account, or else gets that side created.
//
//   node --env-file=.env backend/scripts/createMissingTransferSides.js [--user <email>] [--apply]
//
// Without --apply, only prints what it would do. Safe to run again: a transfer
// that has its other side is left alone.
import mongoose from 'mongoose';
import Account from '../src/models/Account.js';
import Transaction from '../src/models/Transaction.js';
import User from '../src/models/User.js';
import { autoLinkTransfers, createMissingSide } from '../src/lib/transfers.js';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const email = args.includes('--user') ? args[args.indexOf('--user') + 1] : null;

await mongoose.connect(process.env.MONGO_URL);
const users = await User.find(email ? { email } : {});
if (email && !users.length) throw new Error(`No user ${email}`);

let total = 0;
for (const user of users) {
  const lone = await Transaction.find({ user: user._id, transferAccount: { $ne: null }, transferPeer: null }).sort({
    date: 1,
  });
  if (!lone.length) continue;
  const accounts = await Account.find({ user: user._id }, 'name').lean();
  const name = new Map(accounts.map((a) => [String(a._id), a.name]));
  console.log(`\n${user.email}: ${lone.length} transfer(s) without their other side`);

  for (const t of lone) {
    const line = `${t.date.toISOString().slice(0, 10)}  ${(t.amountCents / 100).toFixed(2).padStart(10)}  ${name.get(String(t.account))} -> ${name.get(String(t.transferAccount))}`;
    if (!name.has(String(t.transferAccount))) {
      console.log(`  ${line}  SKIPPED: other account not found`);
      continue;
    }
    if (!apply) {
      console.log(`  ${line}`);
      continue;
    }
    // Reloaded: an earlier row of this loop may have linked it
    const current = await Transaction.findOne({ _id: t._id, user: user._id }).lean();
    if (current.transferPeer) continue;
    const outcome = (await autoLinkTransfers([current])) ? 'linked' : (await createMissingSide(current), 'created');
    console.log(`  ${line}  ${outcome}`);
    total++;
  }
}

console.log(apply ? `\n${total} transfer(s) fixed` : '\nDry run: nothing written. Add --apply to write.');
await mongoose.disconnect();
