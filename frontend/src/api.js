async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
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
};

export function formatCents(cents, currency = 'CAD') {
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency }).format(cents / 100);
}

export function toCents(value) {
  return Math.round(parseFloat(String(value).replace(',', '.')) * 100);
}
