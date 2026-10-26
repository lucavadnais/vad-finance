// The phone analysis' period, picked in its tab's bar (its balance curve and
// its spending). On a computer, the cards follow the page's header instead
// (useSelectedPeriod).
import type { Period } from '@/lib/chartData';
import type { Month } from '@/lib/projections';
import { ref } from 'vue';
import { currentMonth } from '@/lib/projections';

const period = ref<Period>('3m');
// With "Mois par mois", the month shown
const month = ref<Month>(currentMonth());

export function useTrendPeriod() {
  return { period, month };
}
