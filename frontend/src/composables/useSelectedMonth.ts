// What the home page shows, shared by its cards: on a computer, the period
// picked in the page's header (App.vue), and with "Mois par mois" the month,
// stepped with arrows beside it (the accounts' total, the spending, the
// budget). A phone has a bar per tab instead, with the month only.
import type { Period } from '@/lib/chartData';
import type { Month } from '@/lib/projections';
import { ref } from 'vue';
import { currentMonth } from '@/lib/projections';

const month = ref<Month>(currentMonth());
const period = ref<Period>('month');

export function useSelectedMonth() {
  return month;
}

export function useSelectedPeriod() {
  return period;
}
