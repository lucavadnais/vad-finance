// Data isolation between users: every account, category, transaction... belongs
// to one user (`user`, the _id of a User), and every query names that user.
//
// Applied to each model holding a user's data, the plugin:
// - adds the required `user` field, which never changes once set;
// - refuses any query whose filter has no `user`, so a forgotten filter fails
//   loudly instead of reading or changing another user's data. Populate is a
//   query too: give it `match: { user }`. A document's own deleteOne() filters
//   on its _id only: use Model.deleteOne({ _id, user }) instead;
// - adds Model.checkOwned(user, ids), for ids sent by the client that point to
//   other documents (a transaction's account, a category's group...).
import mongoose from 'mongoose';

const QUERIES = [
  'countDocuments',
  'deleteMany',
  'deleteOne',
  'distinct',
  'find',
  'findOne',
  'findOneAndDelete',
  'findOneAndReplace',
  'findOneAndUpdate',
  'replaceOne',
  'updateMany',
  'updateOne',
];

const httpError = (status, message) => Object.assign(new Error(message), { status });

export function ownedPlugin(schema) {
  schema.add({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true, index: true },
  });

  schema.pre(QUERIES, function () {
    if (!Object.hasOwn(this.getFilter(), 'user')) {
      throw new Error(`${this.model.modelName}.${this.op}() without a user in its filter`);
    }
  });

  // The first stage must keep only one user's documents
  schema.pre('aggregate', function () {
    if (!Object.hasOwn(this.pipeline()[0]?.$match ?? {}, 'user')) {
      throw new Error(`${this.model().modelName}.aggregate() without a user in its first $match`);
    }
  });

  // Throws a 404 unless each id (null and undefined ignored) is a document of
  // `user`: a client could send the id of another user's account
  schema.statics.checkOwned = async function (user, ...ids) {
    const wanted = [...new Set(ids.flat().filter(Boolean).map(String))];
    if (wanted.length === 0) return;
    const found = await this.countDocuments({ user, _id: { $in: wanted } });
    if (found !== wanted.length) throw httpError(404, `${this.modelName} not found`);
  };
}
