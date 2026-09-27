import type {
  Account,
  AccountType,
  Category,
  CategoryKind,
  ImportSummary,
  ParsedCsv,
  ParsedTransaction,
  Transaction,
  TransactionInput,
} from './types';

interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, ...rest } = options;
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...rest,
    // Files (Blob) are sent as-is, everything else as JSON
    body: body instanceof Blob ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return (res.status === 204 ? null : await res.json()) as T;
}

export const api = {
  getAccounts: () => request<Account[]>('/accounts'),
  createAccount: (body: { name: string; type: AccountType; bank?: string; initialBalanceCents?: number }) =>
    request<Account>('/accounts', { method: 'POST', body }),
  getCategories: () => request<Category[]>('/categories'),
  createCategory: (body: { name: string; kind: CategoryKind }) =>
    request<Category>('/categories', { method: 'POST', body }),
  deleteCategory: (id: string) => request<null>(`/categories/${id}`, { method: 'DELETE' }),
  getTransactions: () => request<Transaction[]>('/transactions'),
  createTransaction: (body: TransactionInput) =>
    request<Transaction>('/transactions', { method: 'POST', body }),
  updateTransaction: (id: string, body: TransactionInput) =>
    request<Transaction>(`/transactions/${id}`, { method: 'PUT', body }),
  deleteTransaction: (id: string) => request<null>(`/transactions/${id}`, { method: 'DELETE' }),
  parseTransactionsCsv: (file: File) =>
    request<ParsedCsv>(`/transactions/parse-csv?fileName=${encodeURIComponent(file.name)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/csv' },
      body: file,
    }),
  importTransactions: (body: { account: string; transactions: ParsedTransaction[] }) =>
    request<ImportSummary>('/transactions/import', { method: 'POST', body }),
};

export function formatCents(cents: number, currency = 'CAD') {
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency }).format(cents / 100);
}

export function toCents(value: string | number) {
  return Math.round(parseFloat(String(value).replace(',', '.')) * 100);
}

// Dates are stored at midnight UTC: read and display them in UTC so the
// day does not shift in the local time zone
export function toDateInput(date: string) {
  return new Date(date).toISOString().slice(0, 10);
}

export function formatDate(date: string) {
  return new Date(date).toLocaleDateString('fr-CA', { timeZone: 'UTC' });
}
