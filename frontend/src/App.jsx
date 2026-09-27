import { useEffect, useState } from 'react';
import { api, formatCents, toCents } from './api.js';

export default function App() {
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [error, setError] = useState('');

  async function refresh() {
    try {
      const [a, t] = await Promise.all([api.getAccounts(), api.getTransactions()]);
      setAccounts(a);
      setTransactions(t);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const totalCents = accounts.reduce((sum, a) => sum + a.balanceCents, 0);

  return (
    <main>
      <h1>Mes finances</h1>
      {error && <p className="error">{error}</p>}

      <section>
        <h2>Comptes — total {formatCents(totalCents)}</h2>
        <ul>
          {accounts.map((a) => (
            <li key={a._id}>
              <strong>{a.name}</strong> ({a.type}) : {formatCents(a.balanceCents, a.currency)}
            </li>
          ))}
        </ul>
        <AccountForm onCreated={refresh} onError={setError} />
      </section>

      <section>
        <h2>Transactions</h2>
        {accounts.length > 0 && (
          <TransactionForm accounts={accounts} onCreated={refresh} onError={setError} />
        )}
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Compte</th>
              <th>Description</th>
              <th>Montant</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t._id}>
                <td>{new Date(t.date).toLocaleDateString('fr-CA')}</td>
                <td>{t.account?.name}</td>
                <td>{t.description}</td>
                <td className={t.amountCents < 0 ? 'negative' : 'positive'}>
                  {formatCents(t.amountCents)}
                </td>
                <td>
                  <button onClick={() => api.deleteTransaction(t._id).then(refresh)}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}

function AccountForm({ onCreated, onError }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('checking');
  const [initialBalance, setInitialBalance] = useState('0');

  async function submit(e) {
    e.preventDefault();
    try {
      await api.createAccount({ name, type, initialBalanceCents: toCents(initialBalance) });
      setName('');
      setInitialBalance('0');
      onCreated();
    } catch (err) {
      onError(err.message);
    }
  }

  return (
    <form onSubmit={submit}>
      <input placeholder="Nom du compte" value={name} onChange={(e) => setName(e.target.value)} required />
      <select value={type} onChange={(e) => setType(e.target.value)}>
        <option value="checking">Chèque</option>
        <option value="savings">Épargne</option>
        <option value="credit">Crédit</option>
        <option value="investment">Placement</option>
        <option value="cash">Comptant</option>
      </select>
      <input
        placeholder="Solde initial"
        value={initialBalance}
        onChange={(e) => setInitialBalance(e.target.value)}
      />
      <button type="submit">Ajouter le compte</button>
    </form>
  );
}

function TransactionForm({ accounts, onCreated, onError }) {
  const [account, setAccount] = useState(accounts[0]._id);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');

  async function submit(e) {
    e.preventDefault();
    try {
      await api.createTransaction({ account, date, description, amountCents: toCents(amount) });
      setDescription('');
      setAmount('');
      onCreated();
    } catch (err) {
      onError(err.message);
    }
  }

  return (
    <form onSubmit={submit}>
      <select value={account} onChange={(e) => setAccount(e.target.value)}>
        {accounts.map((a) => (
          <option key={a._id} value={a._id}>
            {a.name}
          </option>
        ))}
      </select>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      <input
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <input
        placeholder="Montant (négatif = dépense)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        required
      />
      <button type="submit">Ajouter</button>
    </form>
  );
}
