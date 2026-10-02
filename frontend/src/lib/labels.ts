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
  once: 'Une seule fois',
  weekly: 'Hebdomadaire',
  monthly: 'Mensuelle',
  yearly: 'Annuelle',
};

// The unit of "Aux X …" for a repeating one, singular and plural
export const RECURRENCE_UNITS: Record<Exclude<Recurrence, 'once'>, [string, string]> = {
  weekly: ['semaine', 'semaines'],
  monthly: ['mois', 'mois'],
  yearly: ['année', 'ans'],
};
