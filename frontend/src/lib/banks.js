import cibcLogo from '@/assets/banks/cibc.png';
import nbcLogo from '@/assets/banks/nbc.png';

// Keyed by Account.bank
export const BANKS = {
  cibc: { name: 'CIBC', logo: cibcLogo },
  nbc: { name: 'Banque Nationale', logo: nbcLogo },
};

export const ACCOUNT_TYPES = {
  checking: 'Chèque',
  savings: 'Épargne',
  credit: 'Crédit',
  investment: 'Placement',
  cash: 'Comptant',
};
