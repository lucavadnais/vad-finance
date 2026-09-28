<script setup lang="ts">
// The three dashboard charts, all scoped by the period filter above them
import type { Account, Category, CategoryGroup, Transaction } from '@/types';
import type { Period, Row } from '@/lib/chartData';
import { computed, ref } from 'vue';
import {
  PERIODS,
  accountSeries,
  balanceOverTime,
  expenseSeries,
  expensesByMonth,
  expensesByWeek,
  periodStart,
} from '@/lib/chartData';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
const byWeek = computed(() => expensesByWeek(props.transactions, expenses.value, from.value));
const byMonth = computed(() => expensesByMonth(props.transactions, expenses.value, from.value));

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
      title="Dépenses par semaine"
      description="Répartition des dépenses de chaque semaine (du lundi au dimanche) par catégorie."
      :rows="byWeek"
      :series="expenses.series"
      bucket-label="Semaine"
      :format-tick="formatWeekTick"
    />
    <ExpensesChart
      title="Dépenses par mois"
      description="Répartition des dépenses de chaque mois par catégorie."
      :rows="byMonth"
      :series="expenses.series"
      bucket-label="Mois"
    />
    <BalanceChart :rows="balance" :account-series="perAccount" />
  </section>
</template>
