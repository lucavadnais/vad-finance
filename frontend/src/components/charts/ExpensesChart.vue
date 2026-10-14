<script setup lang="ts">
// Spending per bucket (day, week or month), stacked by category. On a phone,
// the bars lie down: one row per bucket, from the oldest at the top
import type { ChartConfig } from '@/components/ui/chart';
import type { ChartSelection, Row, Series } from '@/lib/chartData';
import type { Transaction } from '@/types';
import { computed, ref, watch } from 'vue';
import { useMediaQuery } from '@vueuse/core';
import { ChartColumn, ChartPie, Table2 } from '@lucide/vue';
import { Direction, Orientation, StackedBar } from '@unovis/ts';
import { VisAxis, VisStackedBar, VisTooltip, VisXYContainer } from '@unovis/vue';
import { amountTickFormat } from '@/api';
import { CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartLegendContent } from '@/components/ui/chart';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ExpensesDonut from './ExpensesDonut.vue';
import SelectedTransactions from './SelectedTransactions.vue';
import SeriesTable from './SeriesTable.vue';
import { tooltipTemplate } from './tooltip';

const props = defineProps<{
  title: string;
  description: string;
  rows: Row[];
  series: Series[];
  bucketLabel: string;
  // Short axis label for a bucket (defaults to the row label)
  formatTick?: (row: Row) => string;
  // The clicked segment and its transactions, shown under the chart
  selection: ChartSelection | null;
  selectedTransactions: Transaction[];
  // The share only, no views to pick (a single month: no bars to compare)
  shareOnly?: boolean;
  // Written when there is no spending (e.g. a month to come)
  emptyMessage?: string;
}>();
const emit = defineEmits<{ select: [selection: ChartSelection | null] }>();

// The share of each category first: the most telling view of a period
const view = ref<'chart' | 'share' | 'table'>('share');
watch(
  () => props.shareOnly,
  (only) => only && (view.value = 'share'),
);

const config = computed<ChartConfig>(() =>
  Object.fromEntries(props.series.map((s) => [s.key, { label: s.label, color: s.color }])),
);

const y = computed(() => props.series.map((s) => (d: Row) => Number(d[s.key] ?? 0)));
const color = (_: Row, i: number) => props.series[i]?.color;
const phone = useMediaQuery('(max-width: 767px)');
// Phone: a row's height for each bar, so the chart grows with them
const ROW_HEIGHT = 28;
const height = computed(() => (phone.value ? Math.max(160, props.rows.length * ROW_HEIGHT + 32) : undefined));

// At most ~12 labels on the axis, evenly spaced; every one on a phone, a row each
const tickValues = computed(() => {
  const every = phone.value ? 1 : Math.ceil(props.rows.length / 12);
  return props.rows.map((_, i) => i).filter((i) => i % every === 0);
});
// Half a bar slot on each side, so the first and last bars are not cut by the edges
const bucketDomain = computed<[number, number]>(() => [-0.5, props.rows.length - 0.5]);
const tickLabel = (i: number) => {
  const row = props.rows[Math.round(i)];
  return row ? (props.formatTick?.(row) ?? row.label) : '';
};

const triggers = {
  [StackedBar.selectors.bar]: tooltipTemplate(() => config.value, { hideZero: true, showTotal: true }),
};

// Clicking the same segment again closes the list
function select(selection: ChartSelection) {
  const same = props.selection?.bucket === selection.bucket && props.selection?.keys.join() === selection.keys.join();
  emit('select', same ? null : selection);
}

// Unovis hands the bar's row merged with its stack index
const barEvents = {
  [StackedBar.selectors.bar]: {
    click: (d: Record<string, unknown>) => {
      const row = (d.datum ?? d) as Row & { stackIndex?: number };
      const s = props.series[Number(d.stackIndex ?? row.stackIndex)];
      if (s) select({ keys: [s.key], label: `${s.label} · ${row.label}`, bucket: Number(row.t) });
    },
  },
};
</script>

<template>
  <!-- Rendered inside the analysis (DashboardCharts, phone) and the spending
       card's "Par catégorie" (SpendInsights) -->
  <!-- Phone: flat, under a line (the card is flat there too) -->
  <section class="max-md:border-t max-md:pt-6">
    <Tabs v-model="view" class="gap-6">
      <CardHeader class="max-md:px-0">
        <div>
          <CardTitle>{{ title }}</CardTitle>
          <!-- The parent's description is about the bars and the table (by week,
               month...); the donut is the whole period -->
          <CardDescription>
            {{ view === 'share' ? 'Part de chaque catégorie dans les dépenses de la période.' : description }}
          </CardDescription>
        </div>
        <!-- Beside the title on a computer. Under it on a phone: the options
             on their own line, then the week / month choice at the start of
             the next one, the views at the end -->
        <CardAction
          stack
          class="flex flex-wrap items-center gap-x-4 gap-y-2 max-md:w-full max-md:justify-between @md/card-header:md:justify-end @max-md/card-header:w-full @max-md/card-header:justify-between"
        >
          <!-- Options from the parent for every view (the grouping) -->
          <div v-if="$slots.filters" class="max-md:basis-full @max-md/card-header:basis-full">
            <slot name="filters" />
          </div>
          <!-- Extra controls from the parent (the week / month choice): they
               shape the bars and the table, not the share of the period -->
          <slot v-if="view !== 'share'" name="actions" />
          <!-- Icons only on a phone, so the controls fit on one line; no table there -->
          <TabsList v-if="!shareOnly" class="ml-auto">
            <TabsTrigger value="share" aria-label="Répartition" title="Répartition">
              <ChartPie class="md:hidden" />
              <span class="max-md:sr-only">Répartition</span>
            </TabsTrigger>
            <TabsTrigger value="chart" aria-label="Graphique" title="Graphique">
              <ChartColumn class="md:hidden" />
              <span class="max-md:sr-only">Graphique</span>
            </TabsTrigger>
            <TabsTrigger value="table" aria-label="Tableau" title="Tableau" class="max-md:hidden">
              <Table2 class="md:hidden" />
              <span class="max-md:sr-only">Tableau</span>
            </TabsTrigger>
          </TabsList>
        </CardAction>
      </CardHeader>
      <CardContent class="max-md:px-0">
        <p v-if="rows.length === 0" class="py-12 text-center text-sm text-muted-foreground">
          {{ emptyMessage ?? 'Aucune dépense sur cette période.' }}
        </p>
        <template v-else>
          <TabsContent value="chart">
            <ChartContainer
              :config="config"
              class="mt-2 aspect-auto h-auto"
              :class="!phone && '[&_[data-vis-xy-container]]:h-74'"
            >
              <!-- The buckets on the bars' axis: across on a computer, down on a phone -->
              <VisXYContainer
                :data="rows"
                :height="height"
                :x-domain="phone ? undefined : bucketDomain"
                :y-domain="phone ? bucketDomain : undefined"
                :y-direction="phone ? Direction.South : Direction.North"
                :margin="{ left: 8, right: 8 }"
              >
                <VisStackedBar
                  :x="(_: Row, i: number) => i"
                  :y="y"
                  :color="color"
                  :orientation="phone ? Orientation.Horizontal : Orientation.Vertical"
                  :bar-max-width="phone ? 18 : 24"
                  :rounded-corners="4"
                  :bar-padding="0.2"
                  :events="barEvents"
                />
                <VisAxis
                  :type="phone ? 'y' : 'x'"
                  :tick-format="tickLabel"
                  :tick-values="tickValues"
                  :grid-line="false"
                  :domain-line="true"
                  :tick-line="false"
                />
                <VisAxis
                  :type="phone ? 'x' : 'y'"
                  :tick-format="amountTickFormat"
                  :num-ticks="phone ? 3 : 4"
                  :grid-line="true"
                  :domain-line="false"
                  :tick-line="false"
                />
                <VisTooltip :triggers="triggers" />
              </VisXYContainer>
              <ChartLegendContent />
            </ChartContainer>
          </TabsContent>
          <TabsContent value="share">
            <ExpensesDonut :rows="rows" :series="series" @select="select" />
          </TabsContent>
          <TabsContent value="table">
            <SeriesTable :rows="rows" :series="series" :bucket-label="bucketLabel" show-total />
          </TabsContent>
        </template>
        <!-- The list follows the chart and share views, not the table -->
        <SelectedTransactions
          v-if="view !== 'table'"
          :selection="selection"
          :transactions="selectedTransactions"
          @close="emit('select', null)"
        />
      </CardContent>
    </Tabs>
  </section>
</template>
