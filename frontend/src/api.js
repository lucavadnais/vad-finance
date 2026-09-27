async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    // Files (Blob) are sent as-is, everything else as JSON
    body:
      options.body instanceof Blob ? options.body : options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  getAccounts: () => request('/accounts'),
  createAccount: (body) => request('/accounts', { method: 'POST', body }),
  getTransactions: () => request('/transactions'),
  createTransaction: (body) => request('/transactions', { method: 'POST', body }),
  deleteTransaction: (id) => request(`/transactions/${id}`, { method: 'DELETE' }),
  parseTransactionsCsv: (file) =>
    request(`/transactions/parse-csv?fileName=${encodeURIComponent(file.name)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/csv' },
      body: file,
    }),
  importTransactions: (body) => request('/transactions/import', { method: 'POST', body }),
};

export function formatCents(cents, currency = 'CAD') {
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency }).format(cents / 100);
}

export function toCents(value) {
  return Math.round(parseFloat(String(value).replace(',', '.')) * 100);
}
