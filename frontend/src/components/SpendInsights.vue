<script setup lang="ts">
// Where a month stands (the phone's "Dépenses" tab, a card on a computer): how
// the spending went, laid out like an account's page, then what is left to
// spend (phone only, opening the budget tab: `open-budget`), then where the
// spending went, by category: the month as a donut, or on a computer several
// months picked beside it, as the phone's analysis shows them. The
// spending as a running total over the days of the month: the month in the
// accent color, the median of the three months before in gray behind it, the
// planned spending as a dashed level. On a computer, only the account picked
// in the accounts' total card, when one is (useSelectedAccount). The month is
// shared with the budget card.
import type { Category, Projection, Transaction } from '@/types';
import type { Month } from '@/lib/projections';
import { computed, defineAsyncComponent, ref, watch } from 'vue';
import { ChevronRight } from '@lucide/vue';
import { formatCents } from '@/api';
import { useMediaQuery, useWindowSize } from '@vueuse/core';
import { useFinanceData } from '@/composables/useFinanceData';
import { useSelectedAccount } from '@/composables/useSelectedAccount';
import { useSelectedPeriod } from '@/composables/useSelectedMonth';
import { budget, budgetSection } from '@/lib/budget';
import type { ChartSelection, Period, Row } from '@/lib/chartData';
import {
  PERIODS,
  bucketStart,
  expenseSeries,
  expensesByMonth,
  expensesByWeek,
  periodStart,
  selectedExpenses,
} from '@/lib/chartData';
import { currentMonth, monthLabel, sameMonth } from '@/lib/projections';
import {
  dailySpending,
  daysIn,
  medianRunningTotal,
  runningSpending,
  runningTotal,
  vsUsualPercent,
} from '@/lib/spending';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import TrendChart from './TrendChart.vue';
import VsUsual from './VsUsual.vue';

// The charts pull in Unovis (~1 MB): load them in their own chunk
const ExpensesChart = defineAsyncComponent(() => import('./charts/ExpensesChart.vue'));
import PageBar from './PageBar.vue';

const props = defineProps<{ transactions: Transaction[]; projections: Projection[]; categories: Category[] }>();
const month = defineModel<Month>({ required: true });
const emit = defineEmits<{ 'open-budget': [] }>();
const { accounts, settings, categoryGroups, categoryColors } = useFinanceData();

// Computer: all the accounts' spending, or the one picked in the accounts'
// total card. The budget stays the whole month's (it is not by account).
const account = useSelectedAccount();
const accountName = computed(() => accounts.value.find((a) => a._id === account.value)?.name);
const transactions = computed(() =>
  account.value === 'all' ? props.transactions : props.transactions.filter((t) => t.account?._id === account.value),
);

const now = currentMonth();
const isCurrent = computed(() => sameMonth(month.value, now));
const isFuture = computed(() => Date.UTC(month.value.year, month.value.month) > Date.UTC(now.year, now.month));

// The month's spending: up to today when it is the current one, nothing yet
// for a month to come
const spent = computed(() => {
  if (isFuture.value) return [];
  const total = runningTotal(dailySpending(transactions.value, month.value));
  return isCurrent.value ? total.slice(0, new Date().getUTCDate()) : total;
});

// The three months before, their median day by day (see lib/spending.ts)
const median = computed(() => medianRunningTotal(transactions.value, month.value));
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
// What the card covers, picked in the page's header on a computer: "Mois par
// mois" is the month beside it,
// another period runs up to today; either way its spending day by day, then by
// category. A phone shows the month (its analysis tab has the rest).
const phone = useMediaQuery('(max-width: 767px)');
const period = useSelectedPeriod();
const scope = computed<Period>(() => (phone.value ? 'month' : period.value));
// By week up to three months, by month beyond
const granularity = computed(() => (scope.value === 'week' || scope.value === '3m' ? 'week' : 'month'));

// Another period than a month: its spending day by day up to today, against
// the period of the same length just before it (none for "Tout", or before
// the first transaction)
const DAY = 86_400_000;
const today = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
const firstDay = computed(() => {
  const first = Math.min(...transactions.value.map((t) => Date.parse(t.date)));
  return Number.isFinite(first) ? new Date(Math.floor(first / DAY) * DAY) : today;
});
const periodFrom = computed(() => (scope.value === 'month' ? today : (periodStart(scope.value) ?? firstDay.value)));
const periodDays = computed(() => Math.round((today.getTime() - periodFrom.value.getTime()) / DAY) + 1);
const periodSpent = computed(() => runningSpending(transactions.value, periodFrom.value, periodDays.value));
const previousSpent = computed(() => {
  const from = new Date(periodFrom.value.getTime() - periodDays.value * DAY);
  return scope.value === 'all' || from < firstDay.value
    ? undefined
    : runningSpending(transactions.value, from, periodDays.value);
});
const periodDayLabels = computed(() =>
  Array.from({ length: periodDays.value + 1 }, (_, d) =>
    d === 0
      ? 'Début de la période'
      : new Date(periodFrom.value.getTime() + (d - 1) * DAY).toLocaleDateString('fr-CA', {
          timeZone: 'UTC',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
  ),
);

// The chart on top: the month (against its median and its budget), or the
// period (against the one before)
const top = computed(() =>
  scope.value === 'month'
    ? {
        total: spent.value.at(-1) ?? 0,
        caption: `Dépensé en ${monthLabel(month.value)}`,
        vsUsual: vsUsual.value,
        values: isFuture.value ? [] : [0, ...spent.value],
        compare: median.value ? [0, ...median.value] : undefined,
        target: account.value === 'all' ? plannedCents.value : undefined,
        slots: slots.value,
        xLabels: dayLabels.value,
        mainLabel: isCurrent.value ? 'Ce mois-ci' : 'Ce mois-là',
        compareLabel: 'Méd. 3 mois',
      }
    : {
        total: periodSpent.value.at(-1) ?? 0,
        caption: `Dépensé · ${PERIODS[scope.value]}`,
        vsUsual: previousSpent.value ? vsUsualPercent(periodSpent.value.at(-1) ?? 0, previousSpent.value.at(-1)) : null,
        values: [0, ...periodSpent.value],
        compare: previousSpent.value ? [0, ...previousSpent.value] : undefined,
        target: undefined,
        slots: undefined,
        xLabels: periodDayLabels.value,
        mainLabel: 'Cette période',
        compareLabel: 'Précédente',
      },
);
const DESCRIPTIONS = {
  week: 'Dépenses de chaque semaine (du lundi au dimanche), par catégorie.',
  month: 'Dépenses de chaque mois, par catégorie.',
};
const BUCKET_LABELS = { week: 'Semaine', month: 'Mois' };
const formatWeekTick = (row: Row) =>
  new Date(row.t).toLocaleDateString('fr-CA', { timeZone: 'UTC', day: 'numeric', month: 'short' });

// The month: from its first day to its last (today for the current one)
const monthStart = computed(() => new Date(Date.UTC(month.value.year, month.value.month, 1)));
const monthEnd = computed(() => new Date(Date.UTC(month.value.year, month.value.month + 1, 1)));
const from = computed(() => (scope.value === 'month' ? monthStart.value : periodStart(scope.value)));
const scopeTransactions = computed(() =>
  scope.value === 'month' ? transactions.value.filter((t) => new Date(t.date) < monthEnd.value) : transactions.value,
);
const byCategory = computed(() =>
  expenseSeries(
    scopeTransactions.value,
    props.categories,
    categoryGroups.value,
    categoryColors.value,
    grouped.value,
    from.value,
  ),
);
const byCategoryRows = computed(() => {
  if (scope.value !== 'month')
    return (granularity.value === 'week' ? expensesByWeek : expensesByMonth)(
      transactions.value,
      byCategory.value,
      from.value,
    );
  if (isFuture.value) return [];
  return expensesByMonth(
    scopeTransactions.value,
    byCategory.value,
    monthStart.value,
    isCurrent.value ? new Date() : new Date(monthEnd.value.getTime() - 1),
  );
});
// Clicked slice or bar segment, and the expenses behind it
const selection = ref<ChartSelection | null>(null);
watch([month, grouped, scope, account], () => (selection.value = null));
const selectedTransactions = computed(() =>
  selectedExpenses(
    scopeTransactions.value,
    selection.value,
    byCategory.value.keyOf,
    from.value,
    (t, bucket) => bucketStart(t.date, granularity.value) === bucket,
  ),
);

// The chart: from day 0 (start of the month, nothing spent) to the last day,
// each day labeled in the tooltip
const slots = computed(() => daysIn(month.value) + 1);
// Phone: almost the visible screen's height, under the page's bar and the
// figure above the chart (about 320px with the app's header and the tab bar)
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
    <!-- The month (the budget card's too): in the page's header on a computer
         (App.vue), with the period, in the tab's bar on a phone (the month
         only). The account is picked in the accounts' total card -->
    <CardHeader class="max-md:hidden">
      <div class="col-start-1 flex flex-wrap items-center gap-x-4 gap-y-2">
        <CardTitle class="mr-auto flex min-h-8 min-w-0 items-center gap-2 text-lg">
          Dépenses
          <span v-if="accountName" class="truncate font-normal text-muted-foreground">· {{ accountName }}</span>
        </CardTitle>
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
            {{ formatCents(top.total) }}
          </p>
          <p class="mt-1 text-sm font-medium text-muted-foreground first-letter:uppercase">{{ top.caption }}</p>
        </div>
        <!-- The chart's legend: against the gray line (the median, or the
             period before), its dot; its amounts are in the tooltip, like the
             dashed budget -->
        <VsUsual
          v-if="top.vsUsual !== null"
          :percent="top.vsUsual"
          :previous="scope !== 'month'"
          dot
          align="end"
          class="shrink-0 pt-1 whitespace-nowrap"
        />
      </div>
      <!-- Edge to edge: out of the page's (phone) or the card's side padding -->
      <TrendChart
        :values="top.values"
        empty-message="Le mois n'a pas encore commencé"
        :compare="top.compare"
        :target="top.target"
        :slots="top.slots"
        :x-labels="top.xLabels"
        :height="chartHeight"
        :main-label="top.mainLabel"
        :compare-label="top.compareLabel"
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

      <!-- Last, where the spending went: each category's share of the month,
           or of the period picked (bars to compare beyond a week) -->
      <ExpensesChart
        title="Par catégorie"
        :description="DESCRIPTIONS[granularity]"
        :rows="byCategoryRows"
        :series="byCategory.series"
        :bucket-label="BUCKET_LABELS[granularity]"
        :format-tick="granularity === 'week' ? formatWeekTick : undefined"
        :selection="selection"
        :selected-transactions="selectedTransactions"
        :share-only="scope === 'month' || scope === 'week'"
        :empty-message="
          scope === 'month' && isFuture ? 'Le mois n\'a pas encore commencé.' : 'Aucune dépense sur cette période.'
        "
        class="border-t pt-6 md:-mx-6"
        @select="selection = $event"
      >
        <template v-if="categoryGroups.length > 0" #filters>
          <div class="flex items-center gap-2">
            <Switch id="month-group-categories" v-model="grouped" />
            <Label for="month-group-categories" class="font-normal">Regrouper par groupe</Label>
          </div>
        </template>
      </ExpensesChart>
    </CardContent>
  </Card>
</template>
