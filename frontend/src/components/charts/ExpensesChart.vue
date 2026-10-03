<script setup lang="ts">
// Spending per bucket (day, week or month), stacked by category
import type { ChartConfig } from '@/components/ui/chart';
import type { ChartSelection, Row, Series } from '@/lib/chartData';
import type { Transaction } from '@/types';
import { computed, ref } from 'vue';
import { StackedBar } from '@unovis/ts';
import { VisAxis, VisStackedBar, VisTooltip, VisXYContainer } from '@unovis/vue';
import { formatCentsCompact } from '@/api';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
}>();
const emit = defineEmits<{ select: [selection: ChartSelection | null] }>();

const view = ref<'chart' | 'share' | 'table'>('chart');

const config = computed<ChartConfig>(() =>
  Object.fromEntries(props.series.map((s) => [s.key, { label: s.label, color: s.color }])),
);

const y = computed(() => props.series.map((s) => (d: Row) => Number(d[s.key] ?? 0)));
const color = (_: Row, i: number) => props.series[i]?.color;
// At most ~12 labels on the axis, evenly spaced
const tickValues = computed(() => {
  const every = Math.ceil(props.rows.length / 12);
  return props.rows.map((_, i) => i).filter((i) => i % every === 0);
});
// Half a bar slot on each side, so the first and last bars are not cut by the edges
const xDomain = computed<[number, number]>(() => [-0.5, props.rows.length - 0.5]);
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
  <Card>
    <Tabs v-model="view" class="gap-6">
      <CardHeader>
        <div>
          <CardTitle>{{ title }}</CardTitle>
          <CardDescription>{{ description }}</CardDescription>
        </div>
        <CardAction class="flex flex-wrap justify-end gap-2">
          <!-- Extra controls from the parent (the week / month choice): they
               shape the bars and the table, not the share of the period -->
          <slot v-if="view !== 'share'" name="actions" />
          <TabsList>
            <TabsTrigger value="chart">Graphique</TabsTrigger>
            <TabsTrigger value="share">Répartition</TabsTrigger>
            <TabsTrigger value="table">Tableau</TabsTrigger>
          </TabsList>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p v-if="rows.length === 0" class="py-12 text-center text-sm text-muted-foreground">
          Aucune dépense sur cette période.
        </p>
        <template v-else>
          <TabsContent value="chart">
            <ChartContainer :config="config" class="aspect-auto h-74 mt-2">
              <VisXYContainer :data="rows" :x-domain="xDomain" :margin="{ left: 8, right: 8 }">
                <VisStackedBar
                  :x="(_: Row, i: number) => i"
                  :y="y"
                  :color="color"
                  :bar-max-width="24"
                  :rounded-corners="4"
                  :bar-padding="0.2"
                  :events="barEvents"
                />
                <VisAxis
                  type="x"
                  :tick-format="tickLabel"
                  :tick-values="tickValues"
                  :grid-line="false"
                  :domain-line="true"
                  :tick-line="false"
                />
                <VisAxis
                  type="y"
                  :tick-format="(v: number) => formatCentsCompact(v)"
                  :num-ticks="4"
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
  </Card>
</template>
