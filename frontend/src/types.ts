// Shapes returned by the backend API

// The signed-in user (GET /auth/me), from their Google account
export interface User {
  _id: string;
  email: string;
  name: string;
  // URL of the Google profile picture
  picture: string | null;
}

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
  // Left out of the total of the accounts (see inTotal)
  excludedFromTotal: boolean;
  balanceCents: number;
  transactionCount: number;
  // Transfer sides the app created: an account with only those was never imported
  autoCreatedCount: number;
}

export type AccountInput = Pick<Account, 'name' | 'type' | 'initialBalanceCents' | 'excludedFromTotal'>;

export interface CategoryGroup {
  _id: string;
  name: string;
  // '#rrggbb': its categories are shown in shades of it (see lib/colors.ts)
  color: string;
}

export interface Category {
  _id: string;
  name: string;
  kind: CategoryKind;
  group: string | null;
  // '#rrggbb', shown while the category has no group; in a group it takes a
  // shade of the group's color. Use categoryColors() for the displayed one.
  color: string;
  // In a group: the shade picked, 0 (darkest) to 8 (lightest); null = automatic
  shade: number | null;
  // Kept on its past transactions, no longer offered as a choice
  archived: boolean;
}

// GET /transactions populates account and category
export interface Transaction {
  _id: string;
  account: Pick<Account, '_id' | 'name' | 'logoUpdatedAt'> | null;
  category: Category | null;
  date: string;
  description: string;
  amountCents: number;
  // Transfers between own accounts (no category): the account on the other
  // side, and the linked transaction there
  transferAccount: Pick<Account, '_id' | 'name'> | null;
  transferPeer: string | null;
  // Gain or loss recorded by a value update (api.updateAccountValue): neither
  // spent nor earned, like a transfer
  valuation?: boolean;
}

// GET /transactions?page=&pageSize=
export interface TransactionPage {
  items: Transaction[];
  total: number;
  page: number;
  pageSize: number;
}

export type Recurrence = 'once' | 'weekly' | 'monthly' | 'yearly';

// A planned expense, or an amount to receive (kind 'income'), on a day of the month
export interface Projection {
  _id: string;
  name: string;
  kind: CategoryKind;
  // Always positive: the kind gives the direction
  amountCents: number;
  recurrence: Recurrence;
  // Every how many weeks, months or years
  interval: number;
  // First day it lands on (ISO date)
  startDate: string;
  // Repeating ones: last day it can land on (ISO date), null = no end
  endDate: string | null;
  category: string | null;
}

export type ProjectionInput = Omit<Projection, '_id'>;

// Money put aside in a goal (amountCents > 0), or taken back (< 0)
export interface SavingsMovement {
  _id: string;
  amountCents: number;
  // ISO date
  date: string;
  note: string;
}

export type SavingsMovementInput = Omit<SavingsMovement, '_id'>;

// A virtual safe: a share of the money kept for something, while it stays in
// the accounts. It holds the sum of its movements, or its account's balance
// (see goalHeldCents). The emergency fund is one of them, always first.
// A debt's yearly interest rate in %, from `from` (ISO date, null = from the
// start) until the next rate's day
export interface InterestRate {
  ratePercent: number;
  from: string | null;
}

// A debt's payment: the transactions of this account with this description
// (compared by paymentKey, lib/debts.ts)
export interface PaymentMatch {
  account: string;
  description: string;
}

// How often a debt's additional payments come back: every `interval` weeks,
// months or years
export interface ExtraRecurrence {
  recurrence: Exclude<Recurrence, 'once'>;
  interval: number;
}

export interface SavingsGoal {
  _id: string;
  name: string;
  emergency: boolean;
  // 'debt': a loan paid off, following the payments picked (lib/debts.ts);
  // its savings fields (target, account, movements) are left empty
  kind: 'savings' | 'debt';
  // Null for the emergency fund: the app computes it (lib/savings.ts)
  targetCents: number | null;
  // To reach by this day (ISO date), null = whenever
  dueDate: string | null;
  // Savings only: left out of the total of the accounts (lib/savings.ts)
  hiddenFromTotal: boolean;
  // Its balance is what the goal holds; the movements are then ignored
  account: string | null;
  movements: SavingsMovement[];
  // Emergency fund only, for its computed target (lib/savings.ts): months of
  // essential spending, value and age of the home owned, monthly rental
  // expenses
  // The situation picked (FUND_SITUATIONS' key), null = months typed in
  fundSituation: string | null;
  fundMonths: number;
  homeValueCents: number;
  // Year the home was built, null = unknown
  homeBuiltYear: number | null;
  rentalExpensesCents: number;
  // Emergency fund only: the essential expenses, ids of expense groups (their
  // categories follow them) and of categories without a group (see isEssential)
  essentials: string[];
  // Debt only: what was left to pay on debtStartDate (ISO date); the
  // payments after it lower it
  debtStartCents: number | null;
  debtStartDate: string | null;
  // Debt only: the amount borrowed, when known (null = worked out from the
  // payments, lib/debts.ts)
  loanCents: number | null;
  interestRates: InterestRate[];
  // Debt only: the usual payment's transactions
  paymentMatches: PaymentMatch[];
  // Debt only: additional payments' transactions, how often they come back
  // (null = like the usual payment; the app does not offer another yet), and
  // how many were still planned on extraCountFrom (ISO date; null = until the
  // end)
  extraMatches: PaymentMatch[];
  extraRecurrence: ExtraRecurrence | null;
  extraCount: number | null;
  extraCountFrom: string | null;
  // Debt only: prepayments, ids of the transactions picked
  prepayments: string[];
  // ISO date: when the time to the due date starts
  createdAt: string;
}

export type SavingsGoalInput = Pick<SavingsGoal, 'name' | 'targetCents' | 'dueDate' | 'account' | 'hiddenFromTotal'>;

// A debt (POST /savings-goals with kind 'debt', or PUT)
export type DebtInput = Pick<
  SavingsGoal,
  | 'name'
  | 'debtStartCents'
  | 'debtStartDate'
  | 'loanCents'
  | 'interestRates'
  | 'paymentMatches'
  | 'extraRecurrence'
  | 'extraCount'
  | 'extraMatches'
> & { kind: 'debt' };

// The emergency fund's settings (PUT /savings-goals/:id)
export type EmergencyFundInput = Pick<
  SavingsGoal,
  | 'targetCents'
  | 'account'
  | 'fundSituation'
  | 'fundMonths'
  | 'homeValueCents'
  | 'homeBuiltYear'
  | 'rentalExpensesCents'
  | 'essentials'
  | 'hiddenFromTotal'
>;

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
  // The bank's own category, when its CSV has one (preselects ours if the names match)
  bankCategory?: string;
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
  // Imported transfers whose other side was not in the app: created there
  created: number;
}

// App settings (GET/PUT /settings)
export interface Settings {
  // Kept aside each month for unplanned spending, see lib/budget.ts
  budgetBufferCents: number;
  // Charts show their axes (TrendChart)
  chartAxes: boolean;
  // The setup wizard was finished or skipped (OnboardingPage). Unknown until
  // the settings are loaded
  onboardingDone?: boolean;
  // The announcements already shown (lib/announcements.ts)
  seenAnnouncements?: string[];
}
