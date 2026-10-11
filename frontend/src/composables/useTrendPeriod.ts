// The phone analysis' period, picked in its tab's bar (its balance curve and
// its spending). On a computer, the cards follow the page's header instead
// (useSelectedPeriod).
import type { TrendPeriod } from '@/lib/chartData';
import { ref } from 'vue';

const period = ref<TrendPeriod>('3m');

export function useTrendPeriod() {
  return period;
}
