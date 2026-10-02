<script setup lang="ts">
// The three dashboard charts, all scoped by the period filter above them
import type { Account, Category, CategoryGroup, Transaction } from '@/types';
import type { ChartSelection, Granularity, Period, Row } from '@/lib/chartData';
import { computed, ref, watch } from 'vue';
import {
  PERIODS,
  accountSeries,
  balanceOverTime,
  bucketStart,
  expenseSeries,
  expensesByDay,
  expensesByMonth,
  expensesByWeek,
  isExpense,
  periodStart,
} from '@/lib/chartData';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import OptionSelect from '../OptionSelect.vue';
import BalanceChart from './BalanceChart.vue';
import ExpensesChart from './ExpensesChart.vue';

const props = defineProps<{
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  groups: CategoryGroup[];
}>();

const period = ref<Period>('month');
const from = computed(() => periodStart(period.value));

// Count grouped categories under their group (e.g. "Milieu de vie")
const grouped = ref(false);
const expenses = computed(() =>
  expenseSeries(props.transactions, props.categories, props.groups, grouped.value, from.value),
);
// Spending bucketed by week (Monday to Sunday) or month, as picked. This week
// is by day instead: the "Jour" option then shows up, active, and week and
// month are greyed out.
const picked = ref<Exclude<Granularity, 'day'>>('week');
const byDay = computed(() => period.value === 'week');
const granularity = computed<Granularity>({
  get: () => (byDay.value ? 'day' : picked.value),
  set: (g) => {
    if (g !== 'day') picked.value = g;
  },
});
const BY = { day: expensesByDay, week: expensesByWeek, month: expensesByMonth };
const expenseRows = computed(() => BY[granularity.value](props.transactions, expenses.value, from.value));

const DESCRIPTIONS: Record<Granularity, string> = {
  day: 'Dépenses de chaque jour, par catégorie.',
  week: 'Dépenses de chaque semaine (du lundi au dimanche), par catégorie.',
  month: 'Dépenses de chaque mois, par catégorie.',
};
const BUCKET_LABELS: Record<Granularity, string> = { day: 'Jour', week: 'Semaine', month: 'Mois' };

// Clicked bar segment or donut slice, and the expenses behind it
const selection = ref<ChartSelection | null>(null);
watch([period, granularity, grouped], () => (selection.value = null));

const selectedTransactions = computed(() => {
  const sel = selection.value;
  if (!sel) return [];
  const keys = new Set(sel.keys);
  return props.transactions
    .filter(
      (t) =>
        isExpense(t) &&
        (!from.value || new Date(t.date) >= from.value) &&
        keys.has(expenses.value.keyOf(t)) &&
        (sel.bucket === undefined || bucketStart(t.date, granularity.value) === sel.bucket),
    )
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
});

const formatWeekTick = (row: Row) =>
  new Date(row.t).toLocaleDateString('fr-CA', { timeZone: 'UTC', day: 'numeric', month: 'short' });
// "lun. 28"
const formatDayTick = (row: Row) =>
  new Date(row.t).toLocaleDateString('fr-CA', { timeZone: 'UTC', weekday: 'short', day: 'numeric' });
const TICKS: Partial<Record<Granularity, (row: Row) => string>> = { day: formatDayTick, week: formatWeekTick };

const perAccount = computed(() => accountSeries(props.accounts));
const balance = computed(() =>
  balanceOverTime(props.transactions, props.accounts, perAccount.value, from.value),
);
</script>

<template>
  <section class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center gap-3">
      <h2 class="mr-auto text-xl font-semibold">Analyse</h2>
      <div v-if="groups.length > 0" class="flex items-center gap-2">
        <Switch id="group-categories" v-model="grouped" />
        <Label for="group-categories" class="font-normal">Regrouper par groupe</Label>
      </div>
      <span class="text-sm text-muted-foreground">Période</span>
      <OptionSelect v-model="period" :options="PERIODS" class="w-44" />
    </div>

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
      <template #actions>
        <Tabs v-model="granularity">
          <TabsList>
            <TabsTrigger v-if="byDay" value="day">Jour</TabsTrigger>
            <TabsTrigger value="week" :disabled="byDay">Semaine</TabsTrigger>
            <TabsTrigger value="month" :disabled="byDay">Mois</TabsTrigger>
          </TabsList>
        </Tabs>
      </template>
    </ExpensesChart>
    <BalanceChart :rows="balance" :account-series="perAccount" />
  </section>
</template>
