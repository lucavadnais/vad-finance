import type {
  Account,
  AccountInput,
  Category,
  CategoryGroup,
  CategoryKind,
  DuplicateMatch,
  DuplicatePair,
  ImportSummary,
  ParsedCsv,
  ParsedTransaction,
  Projection,
  Settings,
  ProjectionInput,
  SavingsGoal,
  SavingsGoalInput,
  DebtInput,
  EmergencyFundInput,
  SavingsMovementInput,
  Transaction,
  TransactionInput,
  TransactionPage,
  TransferCandidate,
  TransferInput,
  User,
} from './types';
import { computed } from 'vue';
import { amountsHidden } from './composables/useAmountsHidden';

interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
}

// Called when the API answers 401 outside /auth: the session ended (useAuth
// then shows the sign-in page)
let onUnauthorized = () => {};
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, ...rest } = options;
  // No answer at all (offline, server down): fetch's own "Failed to fetch" means nothing to the user
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...rest,
    // Files (Blob) are sent as-is, everything else as JSON
    body: body instanceof Blob ? body : body !== undefined ? JSON.stringify(body) : undefined,
  }).catch(() => {
    throw new Error('Serveur injoignable, vérifiez votre connexion');
  });
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/')) onUnauthorized();
    const data = await res.json().catch(() => ({}));
    // No message from the API (e.g. a proxy's error page)
    throw new Error(data.error || 'Une erreur est survenue, réessayez');
  }
  return (res.status === 204 ? null : await res.json()) as T;
}

export const api = {
  getAuthConfig: () => request<{ googleClientId: string | null; devLogin: boolean }>('/auth/config'),
  // 401 when nobody is signed in
  getMe: () => request<User>('/auth/me'),
  // `credential`: the ID token Google's sign-in button hands the page
  signInWithGoogle: (credential: string) => request<User>('/auth/google', { method: 'POST', body: { credential } }),
  // Local tests only (DEV_LOGIN=1 on the server)
  signInAsTestUser: () => request<User>('/auth/dev', { method: 'POST' }),
  signOut: () => request<null>('/auth/logout', { method: 'POST' }),
  // The user and all their data, for good
  deleteMe: () => request<null>('/users/me', { method: 'DELETE' }),
  getAccounts: () => request<Account[]>('/accounts'),
  createAccount: (body: AccountInput) => request<Account>('/accounts', { method: 'POST', body }),
  updateAccount: (id: string, body: AccountInput) => request<Account>(`/accounts/${id}`, { method: 'PUT', body }),
  // Without moveTo, the account's transactions are deleted with it
  deleteAccount: (id: string, move?: { to: string; initialBalance: boolean }) =>
    request<null>(
      `/accounts/${id}` +
        (move ? `?moveTo=${encodeURIComponent(move.to)}&moveInitialBalance=${move.initialBalance ? 1 : 0}` : ''),
      { method: 'DELETE' },
    ),
  uploadAccountLogo: (id: string, file: File) =>
    request<Account>(`/accounts/${id}/logo`, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    }),
  deleteAccountLogo: (id: string) => request<Account>(`/accounts/${id}/logo`, { method: 'DELETE' }),
  // The account's real value on `date` ('YYYY-MM-DD'): records the gap with its
  // balance as a gain or loss (null when there is none)
  updateAccountValue: (id: string, body: { date: string; valueCents: number }) =>
    request<Transaction | null>(`/accounts/${id}/valuation`, { method: 'POST', body }),
  getCategories: () => request<Category[]>('/categories'),
  // Without a color, the backend draws one
  createCategory: (body: {
    name: string;
    kind: CategoryKind;
    group?: string | null;
    color?: string | null;
    shade?: number | null;
  }) => request<Category>('/categories', { method: 'POST', body }),
  // { color: null } draws a new color
  updateCategory: (
    id: string,
    body: Partial<Pick<Category, 'name' | 'kind' | 'group' | 'shade' | 'archived'> & { color: string | null }>,
  ) => request<Category>(`/categories/${id}`, { method: 'PUT', body }),
  deleteCategory: (id: string) => request<null>(`/categories/${id}`, { method: 'DELETE' }),
  getCategoryGroups: () => request<CategoryGroup[]>('/category-groups'),
  // Without a color, the backend draws one
  createCategoryGroup: (body: { name: string; color?: string | null }) =>
    request<CategoryGroup>('/category-groups', { method: 'POST', body }),
  // { color: null } draws a new color
  updateCategoryGroup: (id: string, body: { name?: string; color?: string | null }) =>
    request<CategoryGroup>(`/category-groups/${id}`, { method: 'PUT', body }),
  deleteCategoryGroup: (id: string) => request<null>(`/category-groups/${id}`, { method: 'DELETE' }),
  // Every transaction (charts, analysis)
  getTransactions: () => request<Transaction[]>('/transactions'),
  // One page for the transactions table (page starts at 1)
  // from and to: inclusive bounds on the date
  getTransactionsPage: (
    page: number,
    pageSize: number,
    q = '',
    account?: string,
    from?: Date | null,
    to?: Date | null,
  ) =>
    request<TransactionPage>(
      `/transactions?${new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        q,
        ...(account && { account }),
        ...(from && { from: from.toISOString() }),
        ...(to && { to: to.toISOString() }),
      })}`,
    ),
  createTransaction: (body: TransactionInput) => request<Transaction>('/transactions', { method: 'POST', body }),
  updateTransaction: (id: string, body: TransactionInput) =>
    request<Transaction>(`/transactions/${id}`, { method: 'PUT', body }),
  deleteTransaction: (id: string) => request<null>(`/transactions/${id}`, { method: 'DELETE' }),
  getTransferCandidates: () => request<TransferCandidate[]>('/transfers/candidates'),
  createTransfer: (body: TransferInput) => request<unknown>('/transfers', { method: 'POST', body }),
  linkTransfer: (ids: [string, string]) => request<null>('/transfers/link', { method: 'POST', body: { ids } }),
  ignoreTransfer: (ids: [string, string]) => request<null>('/transfers/ignore', { method: 'POST', body: { ids } }),
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
  ignoreDuplicate: (ids: [string, string]) => request<null>('/duplicates/ignore', { method: 'POST', body: { ids } }),
  getProjections: () => request<Projection[]>('/projections'),
  createProjection: (body: ProjectionInput) => request<Projection>('/projections', { method: 'POST', body }),
  updateProjection: (id: string, body: ProjectionInput) =>
    request<Projection>(`/projections/${id}`, { method: 'PUT', body }),
  deleteProjection: (id: string) => request<null>(`/projections/${id}`, { method: 'DELETE' }),
  getSavingsGoals: () => request<SavingsGoal[]>('/savings-goals'),
  createSavingsGoal: (body: SavingsGoalInput | DebtInput) =>
    request<SavingsGoal>('/savings-goals', { method: 'POST', body }),
  updateSavingsGoal: (id: string, body: SavingsGoalInput | EmergencyFundInput | DebtInput) =>
    request<SavingsGoal>(`/savings-goals/${id}`, { method: 'PUT', body }),
  addPrepayment: (id: string, transaction: string) =>
    request<SavingsGoal>(`/savings-goals/${id}/prepayments`, { method: 'POST', body: { transaction } }),
  removePrepayment: (id: string, transaction: string) =>
    request<SavingsGoal>(`/savings-goals/${id}/prepayments/${transaction}`, { method: 'DELETE' }),
  deleteSavingsGoal: (id: string) => request<null>(`/savings-goals/${id}`, { method: 'DELETE' }),
  // Puts money aside (amountCents > 0) or takes it back (< 0)
  addSavingsMovement: (id: string, body: SavingsMovementInput) =>
    request<SavingsGoal>(`/savings-goals/${id}/movements`, { method: 'POST', body }),
  deleteSavingsMovement: (id: string, movementId: string) =>
    request<SavingsGoal>(`/savings-goals/${id}/movements/${movementId}`, { method: 'DELETE' }),
  getSettings: () => request<Settings>('/settings'),
  updateSettings: (body: Partial<Settings>) => request<Settings>('/settings', { method: 'PUT', body }),
  importTransactions: (body: {
    account: string;
    transactions: ParsedTransaction[];
    allowDuplicates?: boolean;
    currentBalanceCents?: number;
  }) => request<ImportSummary>('/transactions/import', { method: 'POST', body }),
};

// Image formats the backend accepts for account logos
export const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

// The version in the URL changes with each upload, so the browser can cache it
export function accountLogoUrl(account: Pick<Account, '_id' | 'logoUpdatedAt'>) {
  return account.logoUpdatedAt
    ? `/api/accounts/${account._id}/logo?v=${encodeURIComponent(account.logoUpdatedAt)}`
    : null;
}

// Shown instead of an amount while amounts are hidden (useAmountsHidden).
// Reading the flag here makes every template using these re-render on toggle.
const MASK = '•••• $';
const MASK_COMPACT = '•• $';

export function formatCents(cents: number, currency = 'CAD') {
  if (amountsHidden.value) return MASK;
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency }).format(cents / 100);
}

// "1 000 $", "14 k$": an amount in whole dollars, short enough for a small
// ring (compact from 10 000 $)
export function formatCentsShort(cents: number, currency = 'CAD') {
  if (amountsHidden.value) return MASK_COMPACT;
  if (Math.abs(cents) >= 10000_00) return formatCentsCompact(cents, currency);
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency, maximumFractionDigits: 0 }).format(cents / 100);
}

// "1,2 k$" style, for chart axes
export function formatCentsCompact(cents: number, currency = 'CAD') {
  if (amountsHidden.value) return MASK_COMPACT;
  return new Intl.NumberFormat('fr-CA', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(cents / 100);
}

// Tick format of the charts' amount axes. A new function on each toggle of
// the hidden amounts: Unovis calls it lazily and only redraws the ticks when
// its props change.
export const amountTickFormat = computed(() => {
  const hidden = amountsHidden.value;
  return (cents: number) => (hidden ? MASK_COMPACT : formatCentsCompact(cents));
});

// Spaces are thousands separators: "36 291,28" is 36291.28
export function toCents(value: string | number) {
  return Math.round(parseFloat(String(value).replace(/\s/g, '').replace(',', '.')) * 100);
}

// Keydown of a field taking an amount that cannot be negative: no minus sign
export function noMinus(e: KeyboardEvent) {
  if (e.key === '-') e.preventDefault();
}

// An amount to edit in a field, e.g. "36 291,28" (plain spaces, no currency)
export function centsInput(cents: number) {
  return new Intl.NumberFormat('fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(cents / 100)
    .replace(/\s/g, ' ');
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
// Today (or `years` from now), the user's day, as a date field's value
export function todayInput(years = 0) {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear() + years, d.getMonth(), d.getDate())).toISOString().slice(0, 10);
}

export function toDateInput(date: string) {
  return new Date(date).toISOString().slice(0, 10);
}

export function formatDate(date: string) {
  return new Date(date).toLocaleDateString('fr-CA', { timeZone: 'UTC' });
}
