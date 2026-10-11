<script setup lang="ts">
// The phone's analysis tab: trends over several months (the month itself is
// the spending tab's), all scoped by the period in the tab's bar. A computer
// spreads them over other cards: the balance in the accounts' total, the
// spending by category in the spending card.
import type { Account, Category, CategoryGroup, Transaction } from '@/types';
import type { ChartSelection, Granularity, Row } from '@/lib/chartData';
import { computed, ref, watch } from 'vue';
import {
  TREND_PERIODS,
  accountSeries,
  balanceOverTime,
  bucketStart,
  expenseSeries,
  expensesByMonth,
  expensesByWeek,
  periodStart,
  selectedExpenses,
} from '@/lib/chartData';
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

// Several months (see TREND_PERIODS), picked in the tab's bar
const period = useTrendPeriod();
const from = computed(() => periodStart(period.value));

// Count grouped categories under their group (e.g. "Milieu de vie")
const { categoryColors } = useFinanceData();
const grouped = ref(false);
const expenses = computed(() =>
  expenseSeries(props.transactions, props.categories, props.groups, categoryColors.value, grouped.value, from.value),
);
// Spending bucketed by week (Monday to Sunday) or month, as picked
const granularity = ref<Exclude<Granularity, 'day'>>('week');
const BY = { week: expensesByWeek, month: expensesByMonth };
const expenseRows = computed(() => BY[granularity.value](props.transactions, expenses.value, from.value));

const DESCRIPTIONS = {
  week: 'Dépenses de chaque semaine (du lundi au dimanche), par catégorie.',
  month: 'Dépenses de chaque mois, par catégorie.',
};
const BUCKET_LABELS = { week: 'Semaine', month: 'Mois' };

// Clicked bar segment or donut slice, and the expenses behind it
const selection = ref<ChartSelection | null>(null);
watch([period, granularity, grouped], () => (selection.value = null));
const selectedTransactions = computed(() =>
  selectedExpenses(
    props.transactions,
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
  balanceOverTime(props.transactions, props.accounts, accountSeries(props.accounts), from.value),
);
</script>

<template>
  <!-- Flat in its tab, like the spending tab -->
  <Card class="rounded-none border-0 bg-transparent py-0 shadow-none">
    <!-- The page's bar, with its period -->
    <PageBar v-model:period="period" title="Analyse" :periods="TREND_PERIODS" />
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
      @select="selection = $event"
    >
      <!-- The grouping: for the spending only, so in its section -->
      <template v-if="groups.length > 0" #filters>
        <div class="flex items-center gap-2">
          <Switch id="group-categories" v-model="grouped" />
          <Label for="group-categories" class="font-normal">Regrouper par groupe</Label>
        </div>
      </template>
      <template #actions>
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
