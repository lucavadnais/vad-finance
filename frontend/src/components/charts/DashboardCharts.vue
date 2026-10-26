<script setup lang="ts">
// The phone's analysis tab: trends over the period in the tab's bar (this
// week, a month at a time, or several months). A computer
// spreads them over other cards: the balance in the accounts' total, the
// spending by category in the spending card.
import type { Account, Category, CategoryGroup, Transaction } from '@/types';
import type { ChartSelection, Granularity, Row } from '@/lib/chartData';
import { computed, ref, watch } from 'vue';
import type { Month } from '@/lib/projections';
import {
  PERIODS,
  accountSeries,
  balanceOverTime,
  bucketStart,
  expenseSeries,
  expensesByMonth,
  expensesByWeek,
  periodStart,
  selectedExpenses,
} from '@/lib/chartData';
import { addMonths, currentMonth, sameMonth } from '@/lib/projections';
import { useFinanceData } from '@/composables/useFinanceData';
import { useTrendPeriod } from '@/composables/useTrendPeriod';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageBar from '../PageBar.vue';
import BalanceChart from './BalanceChart.vue';
import ExpensesChart from './ExpensesChart.vue';

const props = defineProps<{
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  groups: CategoryGroup[];
}>();

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
// A week or a month: nothing to compare, the share of each category only
const shareOnly = computed(() => period.value === 'week' || period.value === 'month');

// Count grouped categories under their group (e.g. "Milieu de vie")
const { categoryColors } = useFinanceData();
const grouped = ref(false);
const expenses = computed(() =>
  expenseSeries(scoped.value, props.categories, props.groups, categoryColors.value, grouped.value, from.value),
);
// Spending bucketed by week (Monday to Sunday) or month, as picked
const granularity = ref<Exclude<Granularity, 'day'>>('week');
const BY = { week: expensesByWeek, month: expensesByMonth };
const expenseRows = computed(() => BY[granularity.value](scoped.value, expenses.value, from.value, now.value));

const DESCRIPTIONS = {
  week: 'Dépenses de chaque semaine (du lundi au dimanche), par catégorie.',
  month: 'Dépenses de chaque mois, par catégorie.',
};
const BUCKET_LABELS = { week: 'Semaine', month: 'Mois' };

// Clicked bar segment or donut slice, and the expenses behind it
const selection = ref<ChartSelection | null>(null);
watch([period, month, granularity, grouped], () => (selection.value = null));
const selectedTransactions = computed(() =>
  selectedExpenses(
    scoped.value,
    selection.value,
    expenses.value.keyOf,
    from.value,
    (t, bucket) => bucketStart(t.date, granularity.value) === bucket,
  ),
);

const formatWeekTick = (row: Row) =>
  new Date(row.t).toLocaleDateString('fr-CA', { timeZone: 'UTC', day: 'numeric', month: 'short' });
const TICKS: Partial<Record<Granularity, (row: Row) => string>> = { week: formatWeekTick };

// The total balance after each day (all accounts summed)
const balance = computed(() =>
  balanceOverTime(scoped.value, props.accounts, accountSeries(props.accounts), from.value, now.value),
);
</script>

<template>
  <!-- Flat in its tab, like the spending tab -->
  <Card class="rounded-none border-0 bg-transparent py-0 shadow-none">
    <!-- The page's bar, with its period (and its month) -->
    <PageBar v-model:period="period" v-model:month="month" title="Analyse" :periods="PERIODS" up-to-now />
    <!-- The balance first, then the spending -->
    <BalanceChart :rows="balance" />
    <ExpensesChart
      title="Dépenses"
      :description="DESCRIPTIONS[granularity]"
      :rows="expenseRows"
      :series="expenses.series"
      :bucket-label="BUCKET_LABELS[granularity]"
      :format-tick="TICKS[granularity]"
      :selection="selection"
      :selected-transactions="selectedTransactions"
      :share-only="shareOnly"
      @select="selection = $event"
    >
      <!-- The grouping: for the spending only, so in its section -->
      <template v-if="groups.length > 0" #filters>
        <div class="flex items-center gap-2">
          <Switch id="group-categories" v-model="grouped" />
          <Label for="group-categories" class="font-normal">Regrouper par groupe</Label>
        </div>
      </template>
      <template v-if="!shareOnly" #actions>
        <Tabs v-model="granularity">
          <TabsList>
            <TabsTrigger value="week">Semaine</TabsTrigger>
            <TabsTrigger value="month">Mois</TabsTrigger>
          </TabsList>
        </Tabs>
      </template>
    </ExpensesChart>
  </Card>
</template>
