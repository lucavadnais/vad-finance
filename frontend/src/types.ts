// Shapes returned by the backend API

export type AccountType = 'checking' | 'savings' | 'credit' | 'investment' | 'cash';
export type CategoryKind = 'income' | 'expense';

export interface Account {
  _id: string;
  name: string;
  type: AccountType;
  bank?: string;
  currency: string;
  initialBalanceCents: number;
  balanceCents: number;
}

export interface Category {
  _id: string;
  name: string;
  kind: CategoryKind;
}

// GET /transactions populates account and category
export interface Transaction {
  _id: string;
  account: Pick<Account, '_id' | 'name'> | null;
  category: Category | null;
  date: string;
  description: string;
  amountCents: number;
}

export interface TransactionInput {
  account: string;
  category?: string | null;
  date: string;
  description: string;
  amountCents: number;
}

export interface ParsedTransaction {
  date: string;
  description: string;
  amountCents: number;
}

export interface ParseError {
  line: number;
  content: string;
  error: string;
}

export interface ParsedCsv {
  accountName: string;
  bank: string | null;
  transactions: ParsedTransaction[];
  errors: ParseError[];
}

export interface ImportSummary {
  inserted: number;
  skipped: number;
}
