// Categories offered to a new user in the setup wizard (OnboardingPage), by
// group. Created when the user reaches the step with none yet (CategoriesStep).
// The backend draws each group's color.
import type { CategoryKind } from '@/types';

export interface SuggestedGroup {
  name: string;
  kind: CategoryKind;
  categories: string[];
}

export const SUGGESTED_GROUPS: SuggestedGroup[] = [
  { name: 'Revenus', kind: 'income', categories: ['Salaire', 'Autres revenus'] },
  {
    name: 'Logement',
    kind: 'expense',
    categories: ['Loyer ou hypothèque', 'Électricité', 'Internet et téléphone', 'Assurance habitation'],
  },
  { name: 'Alimentation', kind: 'expense', categories: ['Épicerie', 'Restaurants', 'Café'] },
  {
    name: 'Transport',
    kind: 'expense',
    categories: ['Essence', 'Transport en commun', 'Entretien auto', 'Assurance auto'],
  },
  { name: 'Santé', kind: 'expense', categories: ['Pharmacie', 'Soins'] },
  { name: 'Loisirs', kind: 'expense', categories: ['Sorties', 'Abonnements', 'Voyages'] },
  { name: 'Achats', kind: 'expense', categories: ['Vêtements', 'Maison'] },
];
