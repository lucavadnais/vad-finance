// Shapes returned by the backend API

export type AccountType = 'checking' | 'savings' | 'credit' | 'investment' | 'cash';
export type CategoryKind = 'income' | 'expense';

export interface Account {
  _id: string;
  name: string;
  type: AccountType;
  // Set when the account has an image (see accountLogoUrl)
  logoUpdatedAt: string | null;
  currency: string;
  initialBalanceCents: number;
  balanceCents: number;
}

export interface CategoryGroup {
  _id: string;
  name: string;
}

export interface Category {
  _id: string;
  name: string;
  kind: CategoryKind;
  group: string | null;
}

// GET /transactions populates account and category
export interface Transaction {
  _id: string;
  account: Pick<Account, '_id' | 'name'> | null;
  category: Category | null;
  date: string;
  description: string;
  amountCents: number;
  // Transfers between own accounts (no category): the account on the other
  // side, and the linked transaction there
  transferAccount: Pick<Account, '_id' | 'name'> | null;
  transferPeer: string | null;
}

// GET /transactions?page=&pageSize=
export interface TransactionPage {
  items: Transaction[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TransactionInput {
  account: string;
  category?: string | null;
  date: string;
  description: string;
  amountCents: number;
  transferAccount?: string | null;
}

export interface TransferInput {
  from: string;
  to: string;
  date: string;
  description: string;
  // Positive: leaves `from`, arrives in `to`
  amountCents: number;
}

// One side of a suggested transfer (category is not populated here)
export interface TransferSide {
  _id: string;
  account: Pick<Account, '_id' | 'name'>;
  date: string;
  description: string;
  amountCents: number;
}

// A saved transaction a new one may duplicate (same account and amount, a few days apart)
export interface DuplicateMatch {
  // Position of the checked transaction in the request
  index: number;
  // 'exact' = same day and description, 'possible' = other label or date
  kind: 'exact' | 'possible';
  match: Pick<Transaction, '_id' | 'date' | 'description' | 'amountCents'>;
}

// Two saved transactions that may be the same one
export interface DuplicatePair {
  a: TransferSide;
  b: TransferSide;
  kind: 'exact' | 'possible';
  days: number;
}

export interface TransferCandidate {
  out: TransferSide;
  in: TransferSide;
  daysApart: number;
}

export interface ParsedTransaction {
  date: string;
  description: string;
  amountCents: number;
  // Chosen in the import preview
  category?: string | null;
  // Transfer between own accounts: the other account
  transferAccount?: string | null;
}

export interface ParseError {
  line: number;
  content: string;
  error: string;
}

export interface ParsedCsv {
  transactions: ParsedTransaction[];
  errors: ParseError[];
}

export interface ImportSummary {
  inserted: number;
  skipped: number;
  // Imported transfers linked to their other side, already in the app
  linked: number;
}
