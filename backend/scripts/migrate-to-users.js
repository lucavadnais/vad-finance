// Gives the data saved before users existed (accounts, transactions... with no
// `user`) to one user, then brings the indexes in line with the models
// (category names unique per user instead of for everyone...).
//
//   npm run migrate:users --prefix backend -- you@gmail.com           # dry run: shows what would change
//   npm run migrate:users --prefix backend -- you@gmail.com --apply   # does it
//
// The user is created with this email if they never signed in yet; their first
// Google sign-in with it links them. Uses MONGO_URL, like the app.
// Running it again is harmless: data that already has a user is left alone.
import mongoose from 'mongoose';
import Account from '../src/models/Account.js';
import Category from '../src/models/Category.js';
import CategoryGroup from '../src/models/CategoryGroup.js';
import Projection from '../src/models/Projection.js';
import Session from '../src/models/Session.js';
import Setting from '../src/models/Setting.js';
import Transaction from '../src/models/Transaction.js';
import User from '../src/models/User.js';

const OWNED = [Account, Category, CategoryGroup, Transaction, Projection, Setting];
// Unique per user: a name the user already uses would clash
const NAMED = [Category, CategoryGroup];

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const email = args
  .find((a) => !a.startsWith('--'))
  ?.trim()
  .toLowerCase();
if (!email || !/^[^\s@]+@[^\s@]+$/.test(email)) {
  console.error('Usage : npm run migrate:users --prefix backend -- <email> [--apply]');
  process.exit(1);
}
if (!process.env.MONGO_URL) {
  console.error('MONGO_URL is not set');
  process.exit(1);
}

// No automatic index or collection creation: a dry run must change nothing
await mongoose.connect(process.env.MONGO_URL, { autoIndex: false, autoCreate: false });
// Through the driver (Model.collection): the models refuse queries without a
// user (lib/owned.js), and here they are exactly what we look for
const orphan = { user: null };

try {
  const existing = await User.findOne({ email });
  console.log(
    existing
      ? `Utilisateur : ${email} (${existing._id}, ${existing.googleSub ? 'déjà connecté avec Google' : 'jamais connecté'})`
      : `Utilisateur : ${email} (sera créé, puis relié à sa première connexion Google)`,
  );

  console.log('\nDonnées sans utilisateur :');
  const counts = new Map();
  for (const Model of OWNED) {
    counts.set(Model, await Model.collection.countDocuments(orphan));
    console.log(`  ${Model.collection.collectionName.padEnd(16)} ${counts.get(Model)}`);
  }

  const problems = [];
  if (counts.get(Setting) > 1)
    problems.push(`${counts.get(Setting)} documents de paramètres sans utilisateur (1 au plus)`);
  let replaceSettings = false;
  if (existing) {
    for (const Model of NAMED) {
      const theirs = await Model.collection.distinct('name', { user: existing._id });
      const clashes = await Model.collection.distinct('name', { ...orphan, name: { $in: theirs } });
      if (clashes.length) {
        problems.push(`${Model.collection.collectionName} déjà utilisés par ${email} : ${clashes.join(', ')}`);
      }
    }
    // Created with the defaults at their first visit: the old ones win
    replaceSettings = counts.get(Setting) > 0 && (await Setting.collection.countDocuments({ user: existing._id })) > 0;
    if (replaceSettings) console.log(`\nLes paramètres actuels de ${email} seront remplacés par les anciens.`);
  }

  console.log('\nIndex :');
  const models = [...OWNED, User, Session];
  for (const Model of models) {
    // A collection that does not exist yet has no index to compare
    const { toDrop, toCreate } = await Model.diffIndexes().catch(() => ({ toDrop: [], toCreate: [] }));
    for (const name of toDrop) console.log(`  ${Model.collection.collectionName} : supprimer ${name}`);
    for (const spec of toCreate) console.log(`  ${Model.collection.collectionName} : créer ${JSON.stringify(spec)}`);
  }

  if (problems.length) {
    console.error('\nImpossible de migrer :');
    for (const p of problems) console.error(`  - ${p}`);
    process.exitCode = 1;
  } else if (!apply) {
    console.log('\nSimulation : rien n’a été modifié. Relancez avec --apply pour migrer.');
  } else {
    const user = existing ?? (await User.create({ email }));
    if (replaceSettings) await Setting.collection.deleteMany({ user: user._id });
    for (const Model of OWNED) {
      const { modifiedCount } = await Model.collection.updateMany(orphan, { $set: { user: user._id } });
      if (modifiedCount) console.log(`${Model.collection.collectionName} : ${modifiedCount} attribués à ${email}`);
    }
    // Drops the indexes the models no longer have (e.g. category names unique
    // for everyone) and builds the missing ones
    for (const Model of models) await Model.syncIndexes();
    console.log('\nMigration terminée.');
  }
} finally {
  await mongoose.disconnect();
}
