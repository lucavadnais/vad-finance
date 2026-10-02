import type { AccountType, CategoryKind, Recurrence } from '@/types';

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

// Projections: an 'income' one is an amount to receive
export const PROJECTION_KINDS: Record<CategoryKind, string> = {
  expense: 'Dépense prévue',
  income: 'Compte à recevoir',
};

export const RECURRENCES: Record<Recurrence, string> = {
  monthly: 'Chaque mois',
  yearly: 'Chaque année',
  once: 'Une seule fois',
};

export const MONTHS = Array.from({ length: 12 }, (_, i) =>
  new Date(Date.UTC(2000, i, 1)).toLocaleDateString('fr-CA', { timeZone: 'UTC', month: 'long' }),
);
