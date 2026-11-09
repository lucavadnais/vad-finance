<script setup lang="ts">
// The phone's analysis page (opened from the home tab's total, `back` going
// back): trends over the period in the tab's bar (this
// week, a month at a time, or several months). A computer
// spreads them over other cards: the balance in the accounts' total, the
// spending by category in the spending card.
import type { Account, Category, CategoryGroup, Transaction } from '@/types';
import type { ChartSelection } from '@/lib/chartData';
import { computed, ref, watch } from 'vue';
import type { Month } from '@/lib/projections';
import {
  PERIODS,
  accountSeries,
  balanceOverTime,
  inTotal,
  expenseSeries,
  expensesByMonth,
  periodStart,
  selectedExpenses,
} from '@/lib/chartData';
import { addMonths, currentMonth, sameMonth } from '@/lib/projections';
import { withoutHidden } from '@/lib/savings';
import { useFinanceData } from '@/composables/useFinanceData';
import { useTrendPeriod } from '@/composables/useTrendPeriod';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import PageBar from '../PageBar.vue';
import BalanceChart from './BalanceChart.vue';
import ExpensesChart from './ExpensesChart.vue';

const props = defineProps<{
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  groups: CategoryGroup[];
}>();
const emit = defineEmits<{ back: [] }>();

// Picked in the tab's bar. "Mois par mois" shows one month at a time, stepped
// with arrows, like an account's page
const { period, month } = useTrendPeriod();
const monthStart = (m: Month) => new Date(Date.UTC(m.year, m.month, 1));
const from = computed(() => (period.value === 'month' ? monthStart(month.value) : periodStart(period.value)));
// A past month ends on its last day: later transactions are left out, and the
// charts stop there instead of today
const end = computed(() =>
  period.value === 'month' && !sameMonth(month.value, currentMonth()) ? monthStart(addMonths(month.value, 1)) : null,
);
const now = computed(() => (end.value ? new Date(end.value.getTime() - 1) : new Date()));
const scoped = computed(() =>
  end.value ? props.transactions.filter((t) => new Date(t.date) < end.value!) : props.transactions,
);

// Count grouped categories under their group (e.g. "Milieu de vie")
const { categoryColors, savingsGoals } = useFinanceData();
const grouped = ref(false);
const expenses = computed(() =>
  expenseSeries(scoped.value, props.categories, props.groups, categoryColors.value, grouped.value, from.value),
);
// The donut sums the period's spending: monthly buckets are enough
const expenseRows = computed(() => expensesByMonth(scoped.value, expenses.value, from.value, now.value));

// Clicked donut slice, and the expenses behind it
const selection = ref<ChartSelection | null>(null);
watch([period, month, grouped], () => (selection.value = null));
const selectedTransactions = computed(() =>
  selectedExpenses(scoped.value, selection.value, expenses.value.keyOf, from.value),
);

// The total balance after each day (the accounts counted in the total,
// summed; the goals hidden from it left out, lib/savings.ts)
const balance = computed(() => {
  const accounts = inTotal(props.accounts);
  const rows = balanceOverTime(scoped.value, accounts, accountSeries(accounts), from.value, now.value);
  return withoutHidden(rows, savingsGoals.value);
});
</script>

<template>
  <!-- Flat in its tab, like the spending tab -->
  <Card class="rounded-none border-0 bg-transparent py-0 shadow-none">
    <!-- The page's bar: back, like an account's page, and its period (and its
         month) -->
    <PageBar
      v-model:period="period"
      v-model:month="month"
      back
      :periods="PERIODS"
      up-to-now
      @back="emit('back')"
    />
    <!-- The balance first, then the spending -->
    <BalanceChart :rows="balance" />
    <ExpensesChart
      title="Dépenses"
      description="Dépenses de chaque mois, par catégorie."
      :rows="expenseRows"
      :series="expenses.series"
      bucket-label="Mois"
      :selection="selection"
      :selected-transactions="selectedTransactions"
      @select="selection = $event"
    >
      <!-- The grouping: for the spending only, so in its section -->
      <template v-if="groups.length > 0" #filters>
        <div class="flex items-center gap-2">
          <Switch id="group-categories" v-model="grouped" />
          <Label for="group-categories" class="font-normal">Regrouper par groupe</Label>
        </div>
      </template>
    </ExpensesChart>
  </Card>
</template>
