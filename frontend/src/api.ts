import type {
  Account,
  AccountType,
  Category,
  CategoryGroup,
  CategoryKind,
  DuplicateMatch,
  DuplicatePair,
  ImportSummary,
  ParsedCsv,
  ParsedTransaction,
  Projection,
  ProjectionInput,
  Transaction,
  TransactionInput,
  TransactionPage,
  TransferCandidate,
  TransferInput,
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
  createAccount: (body: { name: string; type: AccountType; initialBalanceCents?: number }) =>
    request<Account>('/accounts', { method: 'POST', body }),
  uploadAccountLogo: (id: string, file: File) =>
    request<Account>(`/accounts/${id}/logo`, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    }),
  deleteAccountLogo: (id: string) => request<Account>(`/accounts/${id}/logo`, { method: 'DELETE' }),
  getCategories: () => request<Category[]>('/categories'),
  createCategory: (body: { name: string; kind: CategoryKind; group?: string | null }) =>
    request<Category>('/categories', { method: 'POST', body }),
  updateCategory: (id: string, body: Partial<Pick<Category, 'name' | 'kind' | 'group'>>) =>
    request<Category>(`/categories/${id}`, { method: 'PUT', body }),
  deleteCategory: (id: string) => request<null>(`/categories/${id}`, { method: 'DELETE' }),
  getCategoryGroups: () => request<CategoryGroup[]>('/category-groups'),
  createCategoryGroup: (body: { name: string }) =>
    request<CategoryGroup>('/category-groups', { method: 'POST', body }),
  updateCategoryGroup: (id: string, body: { name: string }) =>
    request<CategoryGroup>(`/category-groups/${id}`, { method: 'PUT', body }),
  deleteCategoryGroup: (id: string) => request<null>(`/category-groups/${id}`, { method: 'DELETE' }),
  // Every transaction (charts, analysis)
  getTransactions: () => request<Transaction[]>('/transactions'),
  // One page for the transactions table (page starts at 1)
  getTransactionsPage: (page: number, pageSize: number, q = '') =>
    request<TransactionPage>(
      `/transactions?${new URLSearchParams({ page: String(page), pageSize: String(pageSize), q })}`,
    ),
  createTransaction: (body: TransactionInput) =>
    request<Transaction>('/transactions', { method: 'POST', body }),
  updateTransaction: (id: string, body: TransactionInput) =>
    request<Transaction>(`/transactions/${id}`, { method: 'PUT', body }),
  deleteTransaction: (id: string) => request<null>(`/transactions/${id}`, { method: 'DELETE' }),
  getTransferCandidates: () => request<TransferCandidate[]>('/transfers/candidates'),
  createTransfer: (body: TransferInput) => request<unknown>('/transfers', { method: 'POST', body }),
  linkTransfer: (ids: [string, string]) =>
    request<null>('/transfers/link', { method: 'POST', body: { ids } }),
  ignoreTransfer: (ids: [string, string]) =>
    request<null>('/transfers/ignore', { method: 'POST', body: { ids } }),
  unlinkTransfer: (id: string) => request<null>(`/transfers/link/${id}`, { method: 'DELETE' }),
  parseTransactionsCsv: (file: File) =>
    request<ParsedCsv>('/transactions/parse-csv', {
      method: 'POST',
      headers: { 'Content-Type': 'text/csv' },
      body: file,
    }),
  checkDuplicates: (account: string, transactions: Pick<ParsedTransaction, 'date' | 'description' | 'amountCents'>[]) =>
    request<DuplicateMatch[]>('/transactions/check-duplicates', { method: 'POST', body: { account, transactions } }),
  getDuplicates: () => request<DuplicatePair[]>('/duplicates'),
  ignoreDuplicate: (ids: [string, string]) =>
    request<null>('/duplicates/ignore', { method: 'POST', body: { ids } }),
  getProjections: () => request<Projection[]>('/projections'),
  createProjection: (body: ProjectionInput) => request<Projection>('/projections', { method: 'POST', body }),
  updateProjection: (id: string, body: ProjectionInput) =>
    request<Projection>(`/projections/${id}`, { method: 'PUT', body }),
  deleteProjection: (id: string) => request<null>(`/projections/${id}`, { method: 'DELETE' }),
  importTransactions: (body: { account: string; transactions: ParsedTransaction[]; allowDuplicates?: boolean }) =>
    request<ImportSummary>('/transactions/import', { method: 'POST', body }),
};

// Image formats the backend accepts for account logos
export const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

// The version in the URL changes with each upload, so the browser can cache it
export function accountLogoUrl(account: Pick<Account, '_id' | 'logoUpdatedAt'>) {
  return account.logoUpdatedAt
    ? `/api/accounts/${account._id}/logo?v=${encodeURIComponent(account.logoUpdatedAt)}`
    : null;
}

export function formatCents(cents: number, currency = 'CAD') {
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency }).format(cents / 100);
}

// "1,2 k$" style, for chart axes
export function formatCentsCompact(cents: number, currency = 'CAD') {
  return new Intl.NumberFormat('fr-CA', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(cents / 100);
}

export function toCents(value: string | number) {
  return Math.round(parseFloat(String(value).replace(',', '.')) * 100);
}

// With a category, its kind gives the sign (whatever was typed): expenses are
// negative, income positive. Without one, the typed sign is kept.
export function signedCents(value: string | number, kind?: CategoryKind) {
  const cents = toCents(value);
  if (!kind || Number.isNaN(cents)) return cents;
  return kind === 'expense' ? -Math.abs(cents) : Math.abs(cents);
}

// Dates are stored at midnight UTC: read and display them in UTC so the
// day does not shift in the local time zone
export function toDateInput(date: string) {
  return new Date(date).toISOString().slice(0, 10);
}

export function formatDate(date: string) {
  return new Date(date).toLocaleDateString('fr-CA', { timeZone: 'UTC' });
}
