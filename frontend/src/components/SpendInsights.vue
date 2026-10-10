<script setup lang="ts">
// Where a month stands (the phone's "Dépenses" tab, a card on a computer): how
// the spending went, laid out like an account's page, then what is left to
// spend (phone only, opening the budget tab: `open-budget`), then where the spending went, by
// category (the analysis' donut, for the month). The spending as a running
// total over the days of the month: the month in the accent color, the median
// of the three months before in gray behind it, the planned spending as a
// dashed level. The month is shared with the budget card.
import type { Category, Projection, Transaction } from '@/types';
import type { Month } from '@/lib/projections';
import { computed, defineAsyncComponent, ref, watch } from 'vue';
import { ChevronRight } from '@lucide/vue';
import { formatCents } from '@/api';
import { useMediaQuery, useWindowSize } from '@vueuse/core';
import { useFinanceData } from '@/composables/useFinanceData';
import { budget, budgetSection } from '@/lib/budget';
import type { ChartSelection } from '@/lib/chartData';
import { expenseSeries, expensesByMonth, selectedExpenses } from '@/lib/chartData';
import { currentMonth, monthLabel, sameMonth } from '@/lib/projections';
import { dailySpending, daysIn, medianRunningTotal, runningTotal, vsUsualPercent } from '@/lib/spending';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import TrendChart from './TrendChart.vue';
import VsUsual from './VsUsual.vue';
import SelectedTransactions from './charts/SelectedTransactions.vue';

// The donut pulls in Unovis (~1 MB): load it in its own chunk
const ExpensesDonut = defineAsyncComponent(() => import('./charts/ExpensesDonut.vue'));
import MonthStepper from './MonthStepper.vue';
import PageBar from './PageBar.vue';

const props = defineProps<{ transactions: Transaction[]; projections: Projection[]; categories: Category[] }>();
const month = defineModel<Month>({ required: true });
const emit = defineEmits<{ 'open-budget': [] }>();
const { settings, categoryGroups, categoryColors } = useFinanceData();

const now = currentMonth();
const isCurrent = computed(() => sameMonth(month.value, now));
const isFuture = computed(() => Date.UTC(month.value.year, month.value.month) > Date.UTC(now.year, now.month));

// The month's spending: up to today when it is the current one, nothing yet
// for a month to come
const spent = computed(() => {
  if (isFuture.value) return [];
  const total = runningTotal(dailySpending(props.transactions, month.value));
  return isCurrent.value ? total.slice(0, new Date().getUTCDate()) : total;
});

// The three months before, their median day by day (see lib/spending.ts)
const median = computed(() => medianRunningTotal(props.transactions, month.value));
// The legend: the month against the median by its last day so far (today,
// or the month's end), as the home's spending tile says it
const vsUsual = computed(() =>
  spent.value.length > 0 ? vsUsualPercent(spent.value.at(-1)!, median.value?.[spent.value.length - 1]) : null,
);

// The month's spending side of the budget, as the spending tile counts it
const spending = computed(() =>
  budgetSection(
    budget(props.projections, props.transactions, props.categories, month.value).expense,
    settings.value.budgetBufferCents,
  ),
);
// The planned spending, buffer included
const plannedCents = computed(() => spending.value.total.plannedCents || undefined);
const spendingProgress = computed(() =>
  plannedCents.value ? Math.min(100, (spending.value.total.actualCents / plannedCents.value) * 100) : null,
);

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
// The screen's height is read again only when its width changes (rotation):
// a phone's address bar showing and hiding while scrolling changes the height,
// and the chart would resize with it.
const { width: screenWidth, height: windowHeight } = useWindowSize();
const screenHeight = ref(windowHeight.value);
watch(screenWidth, () => (screenHeight.value = windowHeight.value));
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
           month to come: nothing spent yet, but its budget and the median) -->
      <div class="flex items-start gap-4">
        <div class="mr-auto min-w-0">
          <p class="text-[clamp(2rem,11vw,3rem)] leading-none font-semibold tracking-tight tabular-nums">
            {{ formatCents(spent.at(-1) ?? 0) }}
          </p>
          <p class="mt-1 text-sm font-medium text-muted-foreground first-letter:uppercase">
            Dépensé en {{ monthLabel(month) }}
          </p>
        </div>
        <!-- The chart's legend: against the median (the gray line, its dot), as
             the home's tile says it; its amounts are in the tooltip, like the
             dashed budget -->
        <VsUsual v-if="vsUsual !== null" :percent="vsUsual" dot align="end" class="shrink-0 pt-1 whitespace-nowrap" />
      </div>
      <!-- Edge to edge: out of the page's (phone) or the card's side padding -->
      <TrendChart
        :values="isFuture ? [] : [0, ...spent]"
        empty-message="Le mois n'a pas encore commencé"
        :compare="median ? [0, ...median] : undefined"
        :target="plannedCents"
        :slots="slots"
        :x-labels="dayLabels"
        :height="chartHeight"
        :main-label="isCurrent ? 'Ce mois-ci' : 'Ce mois-là'"
        compare-label="Méd. 3 mois"
        target-label="Prévu"
        class="-mx-4 md:-mx-6 md:[--chart-gutter:24px]"
      />

      <!-- Phone: then what is left of the month's spending budget, as the
           budget's spending tile counts it; the whole tile opens the budget tab -->
      <button
        type="button"
        class="flex flex-col gap-2 rounded-lg border p-4 text-left text-sm transition-colors hover:bg-muted/50 md:hidden"
        @click="emit('open-budget')"
      >
        <span class="flex items-center gap-2">
          <span v-if="spendingProgress === null" class="text-muted-foreground">Aucune dépense prévue ce mois-ci</span>
          <span v-else-if="spending.summary.overrunCents > 0" class="text-destructive">
            Dépassé de <span class="font-semibold tabular-nums">{{ formatCents(spending.summary.overrunCents) }}</span>
          </span>
          <span v-else>
            Reste à dépenser
            <span class="font-semibold tabular-nums">{{
              formatCents(Math.max(0, spending.total.plannedCents - spending.total.actualCents))
            }}</span>
            <span class="text-muted-foreground tabular-nums"> sur {{ formatCents(plannedCents!) }}</span>
          </span>
          <span class="ml-auto flex shrink-0 items-center text-muted-foreground">
            Budget
            <ChevronRight class="size-4" />
          </span>
        </span>
        <Progress
          v-if="spendingProgress !== null"
          :model-value="spendingProgress"
          class="h-1.5"
          :class="spending.summary.overrunCents > 0 && '*:data-[slot=progress-indicator]:bg-destructive'"
        />
      </button>

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
