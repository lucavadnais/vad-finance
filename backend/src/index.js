import express from 'express';
import cors from 'cors';
import { connectDb } from './db.js';
import accountsRouter from './routes/accounts.js';
import categoriesRouter from './routes/categories.js';
import categoryGroupsRouter from './routes/categoryGroups.js';
import transactionsRouter from './routes/transactions.js';
import transfersRouter from './routes/transfers.js';
import duplicatesRouter from './routes/duplicates.js';
import projectionsRouter from './routes/projections.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/accounts', accountsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/category-groups', categoryGroupsRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/transfers', transfersRouter);
app.use('/api/duplicates', duplicatesRouter);
app.use('/api/projections', projectionsRouter);

// Express 5 forwards rejected promises from async handlers here
app.use((err, req, res, next) => {
  // Errors thrown by our own code with an HTTP status (see lib/transfers.js)
  if (err.status) return res.status(err.status).json({ error: err.message });
  if (err.name === 'ValidationError' || err.name === 'CastError') {
    return res.status(400).json({ error: err.message });
  }
  // Unique index violation (e.g. two categories with the same name)
  if (err.code === 11000) {
    return res.status(409).json({ error: `« ${Object.values(err.keyValue ?? {}).join(', ')} » existe déjà` });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const port = process.env.PORT || 3000;

await connectDb(process.env.MONGO_URL);
app.listen(port, () => console.log(`API listening on port ${port}`));
