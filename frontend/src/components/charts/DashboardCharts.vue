<script setup lang="ts">
// The three dashboard charts, all scoped by the period filter above them. The
// "Mois par mois" period shows one month at a time, stepped with arrows.
import type { Account, Category, CategoryGroup, Transaction } from '@/types';
import type { ChartSelection, Granularity, Period, Row } from '@/lib/chartData';
import type { Month } from '@/lib/projections';
import { computed, ref, watch } from 'vue';
import { ChevronLeft, ChevronRight, RotateCcw } from '@lucide/vue';
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
import { addMonths, currentMonth, monthLabel, sameMonth } from '@/lib/projections';
import { useFinanceData } from '@/composables/useFinanceData';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardHeader, CardTitle } from '@/components/ui/card';
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
// Month shown by the "Mois par mois" period, up to the current one
const month = ref<Month>(currentMonth());
const isCurrentMonth = computed(() => sameMonth(month.value, currentMonth()));
const monthStart = (m: Month) => new Date(Date.UTC(m.year, m.month, 1));

const from = computed(() => (period.value === 'month' ? monthStart(month.value) : periodStart(period.value)));
// A past month ends on its last day: later transactions are left out, and the
// charts stop there instead of today
const end = computed(() =>
  period.value === 'month' && !isCurrentMonth.value ? monthStart(addMonths(month.value, 1)) : null,
);
const transactions = computed(() =>
  end.value ? props.transactions.filter((t) => new Date(t.date) < end.value!) : props.transactions,
);
const now = computed(() => (end.value ? new Date(end.value.getTime() - 1) : new Date()));

// Count grouped categories under their group (e.g. "Milieu de vie")
const { categoryColors } = useFinanceData();
const grouped = ref(false);
const expenses = computed(() =>
  expenseSeries(transactions.value, props.categories, props.groups, categoryColors.value, grouped.value, from.value),
);
// Spending bucketed by week (Monday to Sunday) or month, as picked. This week
// is by day instead: the "Jour" option then shows up, active, and week and
// month are greyed out. A single month is by week (one bar for the month says
// nothing): month is greyed out.
const picked = ref<Exclude<Granularity, 'day'>>('week');
const byDay = computed(() => period.value === 'week');
const oneMonth = computed(() => period.value === 'month');
const granularity = computed<Granularity>({
  get: () => (byDay.value ? 'day' : oneMonth.value ? 'week' : picked.value),
  set: (g) => {
    if (g !== 'day') picked.value = g;
  },
});
const BY = { day: expensesByDay, week: expensesByWeek, month: expensesByMonth };
const expenseRows = computed(() => BY[granularity.value](transactions.value, expenses.value, from.value, now.value));

const DESCRIPTIONS: Record<Granularity, string> = {
  day: 'Dépenses de chaque jour, par catégorie.',
  week: 'Dépenses de chaque semaine (du lundi au dimanche), par catégorie.',
  month: 'Dépenses de chaque mois, par catégorie.',
};
const BUCKET_LABELS: Record<Granularity, string> = { day: 'Jour', week: 'Semaine', month: 'Mois' };

// Clicked bar segment or donut slice, and the expenses behind it
const selection = ref<ChartSelection | null>(null);
watch([period, month, granularity, grouped], () => (selection.value = null));

const selectedTransactions = computed(() => {
  const sel = selection.value;
  if (!sel) return [];
  const keys = new Set(sel.keys);
  return transactions.value
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
  balanceOverTime(transactions.value, props.accounts, perAccount.value, from.value, now.value),
);
</script>

<template>
  <Card>
    <CardHeader>
      <!-- The period and the month's arrows next to the title, like the budget card -->
      <CardTitle class="flex min-h-8 flex-wrap items-center gap-1 text-xl">
        Analyse
        <OptionSelect v-model="period" :options="PERIODS" class="ml-2 w-44 text-sm font-normal" />
        <span v-if="period === 'month'" class="ml-2 flex items-center gap-1 text-sm font-medium">
          <Button size="icon-sm" variant="ghost" aria-label="Mois précédent" @click="month = addMonths(month, -1)">
            <ChevronLeft />
          </Button>
          <span class="min-w-28 text-center first-letter:uppercase">{{ monthLabel(month) }}</span>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Mois suivant"
            :disabled="isCurrentMonth"
            @click="month = addMonths(month, 1)"
          >
            <ChevronRight />
          </Button>
          <Button
            v-if="!isCurrentMonth"
            size="icon-sm"
            variant="ghost"
            aria-label="Revenir au mois courant"
            title="Revenir au mois courant"
            @click="month = currentMonth()"
          >
            <RotateCcw />
          </Button>
        </span>
      </CardTitle>
      <CardAction class="flex flex-wrap items-center justify-end gap-3">
        <div v-if="groups.length > 0" class="flex items-center gap-2">
          <Switch id="group-categories" v-model="grouped" />
          <Label for="group-categories" class="font-normal">Regrouper par groupe</Label>
        </div>
      </CardAction>
    </CardHeader>
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
            <TabsTrigger value="month" :disabled="byDay || oneMonth">Mois</TabsTrigger>
          </TabsList>
        </Tabs>
      </template>
    </ExpensesChart>
    <BalanceChart :rows="balance" :account-series="perAccount" />
  </Card>
</template>
