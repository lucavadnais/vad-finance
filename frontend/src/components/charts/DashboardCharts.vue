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

const period = ref<Period>('12m');
const from = computed(() => periodStart(period.value));

// Count grouped categories under their group (e.g. "Milieu de vie")
const grouped = ref(false);
const expenses = computed(() =>
  expenseSeries(props.transactions, props.categories, props.groups, grouped.value),
);
// Spending bucketed by week (Monday to Sunday) or by month
const granularity = ref<Granularity>('month');
const expenseRows = computed(() =>
  granularity.value === 'week'
    ? expensesByWeek(props.transactions, expenses.value, from.value)
    : expensesByMonth(props.transactions, expenses.value, from.value),
);

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
      :description="
        granularity === 'week'
          ? 'Dépenses de chaque semaine (du lundi au dimanche), par catégorie.'
          : 'Dépenses de chaque mois, par catégorie.'
      "
      :rows="expenseRows"
      :series="expenses.series"
      :bucket-label="granularity === 'week' ? 'Semaine' : 'Mois'"
      :format-tick="granularity === 'week' ? formatWeekTick : undefined"
      :selection="selection"
      :selected-transactions="selectedTransactions"
      @select="selection = $event"
    >
      <template #actions>
        <Tabs v-model="granularity">
          <TabsList>
            <TabsTrigger value="week">Semaine</TabsTrigger>
            <TabsTrigger value="month">Mois</TabsTrigger>
          </TabsList>
        </Tabs>
      </template>
    </ExpensesChart>
    <BalanceChart :rows="balance" :account-series="perAccount" />
  </section>
</template>
