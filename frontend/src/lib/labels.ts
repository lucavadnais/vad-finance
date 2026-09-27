import type { AccountType, CategoryKind } from '@/types';

// French labels for the enum values stored by the backend
export const ACCOUNT_TYPES: Record<AccountType, string> = {
  checking: 'Chèque',
  savings: 'Épargne',
  credit: 'Crédit',
  investment: 'Placement',
  cash: 'Comptant',
};

export const CATEGORY_KINDS: Record<CategoryKind, string> = {
  expense: 'Dépense',
  income: 'Revenu',
};
