<script setup lang="ts">
// Where a month stands (the phone's "Dépenses" tab, a card on a computer): how
// the spending went, laid out like an account's page, then the budget's net,
// income and spending tiles, then where the spending went, by category (the
// analysis' donut, for the month). The spending as a running total over the
// days of the month: the month in the accent color, the average of the three
// months before in gray behind it, the planned spending as a dashed level. The
// month is shared with the budget card, and its forecasts open there (`edit`).
import type { Category, Projection, Transaction } from '@/types';
import type { Month } from '@/lib/projections';
import { computed, defineAsyncComponent, ref, watch } from 'vue';
import { formatCents } from '@/api';
import { useMediaQuery, useWindowSize } from '@vueuse/core';
import { useFinanceData } from '@/composables/useFinanceData';
import { budget, budgetSection } from '@/lib/budget';
import type { ChartSelection } from '@/lib/chartData';
import { expenseSeries, expensesByMonth, selectedExpenses } from '@/lib/chartData';
import { addMonths, currentMonth, monthLabel, sameMonth } from '@/lib/projections';
import { dailySpending, daysIn, runningTotal } from '@/lib/spending';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import BudgetSummary from './BudgetSummary.vue';
import TrendChart from './TrendChart.vue';
import SelectedTransactions from './charts/SelectedTransactions.vue';

// The donut pulls in Unovis (~1 MB): load it in its own chunk
const ExpensesDonut = defineAsyncComponent(() => import('./charts/ExpensesDonut.vue'));
import MonthStepper from './MonthStepper.vue';
import PageBar from './PageBar.vue';

const props = defineProps<{ transactions: Transaction[]; projections: Projection[]; categories: Category[] }>();
const month = defineModel<Month>({ required: true });
const emit = defineEmits<{ edit: [projection: Projection] }>();
const { settings, categoryGroups, categoryColors } = useFinanceData();

const now = currentMonth();
const isCurrent = computed(() => sameMonth(month.value, now));
const isFuture = computed(() => Date.UTC(month.value.year, month.value.month) > Date.UTC(now.year, now.month));

// Side of the budget shown by category (income or spending tile clicked)
const expanded = ref<'income' | 'expense' | null>(null);

// The month's spending: up to today when it is the current one, nothing yet
// for a month to come
const spent = computed(() => {
  if (isFuture.value) return [];
  const total = runningTotal(dailySpending(props.transactions, month.value));
  return isCurrent.value ? total.slice(0, new Date().getUTCDate()) : total;
});

// The three months before, from the first one with any transaction: the
// average running total of each day (a shorter month stays at its total)
const firstDate = computed(() => Math.min(...props.transactions.map((t) => Date.parse(t.date))));
const average = computed(() => {
  const months = [1, 2, 3]
    .map((i) => addMonths(month.value, -i))
    .filter((m) => Date.UTC(m.year, m.month + 1, 1) > firstDate.value);
  if (months.length === 0) return null;
  const totals = months.map((m) => runningTotal(dailySpending(props.transactions, m)));
  return Array.from(
    { length: daysIn(month.value) },
    (_, d) => totals.reduce((sum, t) => sum + t[Math.min(d, t.length - 1)]!, 0) / totals.length,
  );
});
const averageCents = computed(() => (average.value ? Math.round(average.value.at(-1)!) : null));

// The month's spending side of the budget, as the spending tile counts it
const spending = computed(() =>
  budgetSection(
    budget(props.projections, props.transactions, props.categories, month.value).expense,
    settings.value.budgetBufferCents,
  ),
);
// The planned spending, buffer included
const plannedCents = computed(() => spending.value.total.plannedCents || undefined);

// Count grouped categories under their group (e.g. "Milieu de vie")
const grouped = ref(false);
// The month's spending by category, as in the analysis: from its first day to
// its last (today for the current one)
const monthStart = computed(() => new Date(Date.UTC(month.value.year, month.value.month, 1)));
const monthEnd = computed(() => new Date(Date.UTC(month.value.year, month.value.month + 1, 1)));
const monthTransactions = computed(() => props.transactions.filter((t) => new Date(t.date) < monthEnd.value));
const byCategory = computed(() =>
  expenseSeries(
    monthTransactions.value,
    props.categories,
    categoryGroups.value,
    categoryColors.value,
    grouped.value,
    monthStart.value,
  ),
);
const byCategoryRows = computed(() =>
  isFuture.value
    ? []
    : expensesByMonth(
        monthTransactions.value,
        byCategory.value,
        monthStart.value,
        isCurrent.value ? new Date() : new Date(monthEnd.value.getTime() - 1),
      ),
);
// Tapped slice, and the expenses behind it
const selection = ref<ChartSelection | null>(null);
watch([month, grouped], () => (selection.value = null));
const selectedTransactions = computed(() =>
  selectedExpenses(monthTransactions.value, selection.value, byCategory.value.keyOf, monthStart.value),
);

// The chart: from day 0 (start of the month, nothing spent) to the last day,
// each day labeled in the tooltip
const slots = computed(() => daysIn(month.value) + 1);
// Phone: almost the visible screen's height, under the page's bar and the
// figure above the chart (about 320px with the app's header and the tab bar)
const phone = useMediaQuery('(max-width: 767px)');
const { height: screenHeight } = useWindowSize();
const chartHeight = computed(() => (phone.value ? Math.max(240, screenHeight.value - 320) : 240));
const dayLabels = computed(() =>
  Array.from({ length: slots.value }, (_, d) =>
    d === 0
      ? 'Début du mois'
      : new Date(Date.UTC(month.value.year, month.value.month, d)).toLocaleDateString('fr-CA', {
          timeZone: 'UTC',
          day: 'numeric',
          month: 'long',
        }),
  ),
);
</script>

<template>
  <!-- A card on a computer; flat in its tab on a phone -->
  <Card class="max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:py-0 max-md:shadow-none">
    <!-- The month (it sets the budget card's too): next to the title on a
         computer; in the page's bar on a phone -->
    <CardHeader class="max-md:hidden">
      <div class="col-start-1 flex flex-wrap items-center gap-x-4 gap-y-2">
        <CardTitle class="flex min-h-8 items-center text-lg">Suivi du mois</CardTitle>
        <MonthStepper v-model="month" />
      </div>
    </CardHeader>
    <PageBar v-model:month="month" title="Dépenses" class="md:hidden" />
    <CardContent class="flex flex-col gap-4 max-md:px-0">
      <!-- First the spending day by day, laid out like an account's page: the
           figure in big, the lines' references beside it, then the chart (a
           month to come: nothing spent yet, but its budget and the average) -->
      <div class="flex items-start gap-4">
        <div class="mr-auto min-w-0">
          <p class="text-[clamp(2rem,11vw,3rem)] leading-none font-semibold tracking-tight tabular-nums">
            {{ formatCents(spent.at(-1) ?? 0) }}
          </p>
          <p class="mt-1 text-sm font-medium text-muted-foreground first-letter:uppercase">
            Dépensé en {{ monthLabel(month) }}
          </p>
        </div>
        <!-- The chart's legend: the average (gray); the dashed budget is in the tooltip and the spending tile -->
        <div class="flex shrink-0 flex-col gap-1.5 pt-1 text-right text-sm whitespace-nowrap">
          <div v-if="averageCents !== null">
            <p class="flex items-center justify-end gap-1.5 text-muted-foreground">
              <span class="size-2.5 rounded-full bg-[var(--brand-gray)]" />
              Moy. 3 mois
            </p>
            <p class="font-semibold tabular-nums">{{ formatCents(averageCents) }}</p>
          </div>
        </div>
      </div>
      <!-- Edge to edge: out of the page's (phone) or the card's side padding -->
      <TrendChart
        :values="isFuture ? [] : [0, ...spent]"
        empty-message="Le mois n'a pas encore commencé"
        :compare="average ? [0, ...average] : undefined"
        :target="plannedCents"
        :slots="slots"
        :x-labels="dayLabels"
        :height="chartHeight"
        :main-label="isCurrent ? 'Ce mois-ci' : 'Ce mois-là'"
        compare-label="Moy. 3 mois"
        target-label="Prévu"
        class="-mx-4 md:-mx-6 md:[--chart-gutter:24px]"
      />

      <!-- Then where the month stands: net, income and spending -->
      <BudgetSummary
        v-model:expanded="expanded"
        :month="month"
        :projections="projections"
        :transactions="transactions"
        :categories="categories"
        class="pt-2"
        @edit="emit('edit', $event)"
      />

      <!-- Last, where the spending went: each category's share of the month -->
      <section class="flex flex-col gap-2 border-t pt-4">
        <!-- The grouping top right, like the analysis' -->
        <div class="flex min-h-8 items-center justify-between gap-2">
          <h3 class="text-sm font-medium">Par catégorie</h3>
          <div v-if="categoryGroups.length > 0" class="flex items-center gap-2">
            <Switch id="month-group-categories" v-model="grouped" />
            <Label for="month-group-categories" class="font-normal">Regrouper par groupe</Label>
          </div>
        </div>
        <p v-if="byCategoryRows.length === 0" class="py-8 text-center text-sm text-muted-foreground">
          {{ isFuture ? "Le mois n'a pas encore commencé." : 'Aucune dépense ce mois-ci.' }}
        </p>
        <template v-else>
          <ExpensesDonut :rows="byCategoryRows" :series="byCategory.series" @select="selection = $event" />
          <SelectedTransactions :selection="selection" :transactions="selectedTransactions" @close="selection = null" />
        </template>
      </section>
    </CardContent>
  </Card>
</template>
