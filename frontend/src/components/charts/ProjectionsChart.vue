<script setup lang="ts">
// Projected expenses and amounts to receive over the next 12 months, side by
// side, or the picked month as a calendar; clicking a month shows it in detail
// below, and its projections under the chart, one row each with the month's total
import type { ChartConfig } from '@/components/ui/chart';
import type { Row, Series } from '@/lib/chartData';
import type { Month } from '@/lib/projections';
import type { Category, Projection } from '@/types';
import { computed, ref } from 'vue';
import { GroupedBar } from '@unovis/ts';
import { VisAxis, VisGroupedBar, VisTooltip, VisXYContainer } from '@unovis/vue';
import { formatCentsCompact } from '@/api';
import { addMonths, currentMonth, monthLabel, occurrences, totals } from '@/lib/projections';
import { ChartContainer, ChartLegendContent } from '@/components/ui/chart';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ProjectionCalendar from '../ProjectionCalendar.vue';
import SeriesTable from './SeriesTable.vue';
import { tooltipTemplate } from './tooltip';

const props = defineProps<{ projections: Projection[]; categories: Category[] }>();
const selected = defineModel<Month>({ required: true });
// pick: a month was clicked in the chart (its detail is shown above)
const emit = defineEmits<{ edit: [projection: Projection]; pick: [] }>();

const MONTHS = 12;
const SERIES: Series[] = [
  { key: 'expense', label: 'Dépenses prévues', color: 'var(--series-2)' },
  { key: 'income', label: 'À recevoir', color: 'var(--series-1)' },
];
const config: ChartConfig = Object.fromEntries(SERIES.map((s) => [s.key, { label: s.label, color: s.color }]));

const view = ref<'chart' | 'calendar' | 'table'>('chart');

const months = Array.from({ length: MONTHS }, (_, i) => addMonths(currentMonth(), i));
const rows = computed<Row[]>(() =>
  months.map((m) => {
    const sums = totals(occurrences(props.projections, m));
    return {
      label: monthLabel(m),
      t: Date.UTC(m.year, m.month, 1),
      expense: sums.expenseCents,
      income: sums.incomeCents,
    };
  }),
);

// A little room above the highest bar, so its rounded top is not cut off
const yDomain = computed<[number, number]>(() => [
  0,
  Math.max(1, ...rows.value.flatMap((r) => SERIES.map((s) => Number(r[s.key] ?? 0)))) * 1.1,
]);
const y = SERIES.map((s) => (d: Row) => Number(d[s.key] ?? 0));
const color = (_: Row, i: number) => SERIES[i]?.color;
// The year only on the first month and on January, so the labels stay short
// enough for one line
const tickLabel = (i: number) => {
  const index = Math.round(i);
  const m = months[index];
  if (!m) return '';
  if (index === 0 || m.month === 0) return monthLabel(m, 'short');
  return new Date(Date.UTC(m.year, m.month, 1)).toLocaleDateString('fr-CA', { timeZone: 'UTC', month: 'short' });
};
// The month shown below stays highlighted, the others fade
// A new function on each change: Unovis only redraws when its props change
const barStyle = computed(() => {
  const t = Date.UTC(selected.value.year, selected.value.month, 1);
  return (d: Row) => ({ opacity: d.t === t ? '1' : '0.45' });
});

const triggers = { [GroupedBar.selectors.bar]: tooltipTemplate(() => config) };
const events = {
  [GroupedBar.selectors.bar]: {
    click: (d: Row) => {
      const m = months.find((m) => Date.UTC(m.year, m.month, 1) === d.t);
      if (m) selected.value = m;
      emit('pick');
    },
  },
};
</script>

<template>
  <Tabs v-model="view" class="gap-3">
    <div class="flex flex-wrap items-center gap-2">
      <div class="mr-auto">
        <h3 class="text-sm font-medium">12 prochains mois</h3>
        <p v-if="view !== 'calendar'" class="text-sm text-muted-foreground">Clique sur un mois pour voir son détail.</p>
        <p v-else class="text-sm text-muted-foreground">Clique sur une prévision pour la modifier.</p>
      </div>
      <TabsList>
        <TabsTrigger value="chart">Graphique</TabsTrigger>
        <TabsTrigger value="calendar">Calendrier</TabsTrigger>
        <TabsTrigger value="table">Tableau</TabsTrigger>
      </TabsList>
    </div>
    <TabsContent value="chart">
      <div class="flex flex-col gap-4">
        <ChartContainer :config="config" class="aspect-auto h-auto [&_[data-vis-xy-container]]:h-64">
          <VisXYContainer :data="rows" :y-domain="yDomain" :margin="{ left: 8, right: 8 }">
            <VisGroupedBar
              :x="(_: Row, i: number) => i"
              :y="y"
              :color="color"
              :bar-style="barStyle"
              :group-max-width="40"
              :group-padding="0.2"
              :bar-padding="0.1"
              :rounded-corners="4"
              cursor="pointer"
              :events="events"
            />
            <VisAxis type="x" :tick-format="tickLabel" :num-ticks="MONTHS" :grid-line="false" :tick-line="false" />
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
      </div>
    </TabsContent>
    <TabsContent value="calendar">
      <ProjectionCalendar
        v-model="selected"
        :projections="projections"
        :min="months[0]!"
        :max="months[MONTHS - 1]!"
        @edit="emit('edit', $event)"
      />
    </TabsContent>
    <TabsContent value="table">
      <SeriesTable :rows="rows" :series="SERIES" bucket-label="Mois" />
    </TabsContent>
  </Tabs>
</template>
