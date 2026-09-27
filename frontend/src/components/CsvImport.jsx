import { useEffect, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { api, formatCents } from '../api.js';
import { ACCOUNT_TYPES, BANKS } from '../lib/banks.js';

export default function CsvImport({ accounts, onImported }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleFile(file) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Le fichier doit être un .csv');
      return;
    }
    setFileName(file.name);
    setLoading(true);
    setError('');
    setMessage('');
    setResult(null);
    try {
      const parsed = await api.parseTransactionsCsv(file);
      setResult(parsed);
      if (parsed.transactions.length > 0) setDialogOpen(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  }

  function onDone(account, { inserted, skipped }) {
    setDialogOpen(false);
    setResult(null);
    setFileName('');
    setMessage(
      `${inserted} transaction(s) importée(s) dans « ${account.name} »` +
        (skipped > 0 ? `, ${skipped} déjà présente(s) ignorée(s)` : ''),
    );
    onImported();
  }

  return (
    <section>
      <h2>Importer un relevé CSV</h2>

      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`my-4 flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          dragging ? 'border-primary bg-muted' : 'border-border hover:bg-muted/50'
        }`}
      >
        <Upload className="size-6 text-muted-foreground" />
        <p>
          {loading ? 'Lecture en cours…' : fileName || 'Glisse un fichier CSV ici ou clique pour le choisir'}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          hidden
          onChange={(e) => {
            handleFile(e.target.files[0]);
            // Allow picking the same file again
            e.target.value = '';
          }}
        />
      </div>

      {error && <p className="error">{error}</p>}
      {message && <p className="positive">{message}</p>}

      {/* Nothing to import: explain why in the card, there is no popup */}
      {result && result.transactions.length === 0 && (
        <>
          <p className="error">Aucune transaction trouvée dans ce fichier.</p>
          <ParseErrors errors={result.errors} />
        </>
      )}

      {dialogOpen && (
        <AccountDialog
          accounts={accounts}
          result={result}
          onCancel={() => {
            setDialogOpen(false);
            setResult(null);
            setFileName('');
          }}
          onDone={onDone}
        />
      )}
    </section>
  );
}

// Asks which account the file belongs to. The file name gives the account name
// and the bank, but not the account type, so the user picks the type here.
function AccountDialog({ accounts, result, onCancel, onDone }) {
  const dialogRef = useRef(null);
  const [name, setName] = useState(result.accountName);
  const [type, setType] = useState(
    () => findAccount(accounts, result.bank, result.accountName)?.type ?? 'checking',
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    dialogRef.current.showModal();
  }, []);

  const existing = findAccount(accounts, result.bank, name, type);
  const bank = BANKS[result.bank];

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const account =
        existing ?? (await api.createAccount({ name: name.trim(), type, bank: result.bank ?? undefined }));
      const summary = await api.importTransactions({
        account: account._id,
        transactions: result.transactions,
      });
      onDone(account, summary);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onCancel}
      className="m-auto w-full max-w-3xl rounded-lg p-6 shadow-xl backdrop:bg-black/40"
    >
      <form onSubmit={submit} className="m-0 flex-col gap-4">
        <div className="flex items-center gap-3">
          {bank && <img src={bank.logo} alt={bank.name} className="size-10 rounded-md" />}
          <h3 className="text-lg font-semibold">Dans quel compte importer ?</h3>
        </div>

        <label className="flex flex-col gap-1">
          Nom du compte
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>

        <label className="flex flex-col gap-1">
          Type de compte
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {Object.entries(ACCOUNT_TYPES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <div>
          <p className="mb-2 font-medium">
            {result.transactions.length} transaction(s) lue(s)
            {result.errors.length > 0 && `, ${result.errors.length} ligne(s) ignorée(s)`}
          </p>
          <ParseErrors errors={result.errors} />
          <div className="max-h-72 overflow-y-auto rounded-md border">
            <table>
              <thead className="sticky top-0 bg-background">
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Montant</th>
                </tr>
              </thead>
              <tbody>
                {result.transactions.map((t, i) => (
                  <tr key={i}>
                    <td className="whitespace-nowrap">{t.date}</td>
                    <td>{t.description}</td>
                    <td className={`whitespace-nowrap ${t.amountCents < 0 ? 'negative' : 'positive'}`}>
                      {formatCents(t.amountCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          {existing
            ? `Les ${result.transactions.length} transaction(s) seront ajoutées au compte existant.`
            : `Un nouveau compte${bank ? ` ${bank.name}` : ''} sera créé avec ${result.transactions.length} transaction(s).`}
        </p>

        {error && <p className="error">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => dialogRef.current.close()} disabled={saving}>
            Annuler
          </button>
          <button type="submit" disabled={saving}>
            {saving ? 'Import…' : 'Importer'}
          </button>
        </div>
      </form>
    </dialog>
  );
}

function ParseErrors({ errors }) {
  if (errors.length === 0) return null;
  return (
    <ul className="error mb-2 text-sm">
      {errors.map((e) => (
        <li key={e.line}>
          Ligne {e.line} : {e.error}
        </li>
      ))}
    </ul>
  );
}

// Same bank and name (case-insensitive), and same type when given
function findAccount(accounts, bank, name, type) {
  const wanted = name.trim().toLowerCase();
  return accounts.find(
    (a) =>
      (a.bank ?? null) === bank &&
      a.name.trim().toLowerCase() === wanted &&
      (type === undefined || a.type === type),
  );
}
