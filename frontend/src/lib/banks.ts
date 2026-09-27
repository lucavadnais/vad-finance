import cibcLogo from '@/assets/banks/cibc.png';
import nbcLogo from '@/assets/banks/nbc.png';

export interface Bank {
  name: string;
  logo: string;
}

// Keyed by Account.bank
export const BANKS: Record<string, Bank> = {
  cibc: { name: 'CIBC', logo: cibcLogo },
  nbc: { name: 'Banque Nationale', logo: nbcLogo },
};
