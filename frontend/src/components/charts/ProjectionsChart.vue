<script setup lang="ts">
// Forecasts vs actual for the month shown by the budget card: a pair of bars
// per category, "Prévu" then "Réalisé". Spending or income, picked above the
// chart. Or that month as a calendar.
import type { ChartConfig } from '@/components/ui/chart';
import type { Row, Series } from '@/lib/chartData';
import type { Month } from '@/lib/projections';
import type { CategoryKind, Category, Projection, Transaction } from '@/types';
import { computed, ref } from 'vue';
import { GroupedBar } from '@unovis/ts';
import { VisAxis, VisGroupedBar, VisTooltip, VisXYContainer } from '@unovis/vue';
import { formatCentsCompact } from '@/api';
import { budget } from '@/lib/budget';
import { addMonths, currentMonth, monthLabel } from '@/lib/projections';
import { ChartContainer, ChartLegendContent } from '@/components/ui/chart';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import OptionSelect from '../OptionSelect.vue';
import ProjectionCalendar from '../ProjectionCalendar.vue';
import SeriesTable from './SeriesTable.vue';
import { tooltipTemplate } from './tooltip';

const props = defineProps<{ projections: Projection[]; transactions: Transaction[]; categories: Category[] }>();
const selected = defineModel<Month>({ required: true });
const emit = defineEmits<{ edit: [projection: Projection] }>();

const KINDS: Record<CategoryKind, string> = { expense: 'Dépenses', income: 'Revenus' };
const kind = ref<CategoryKind>('expense');
const view = ref<'chart' | 'calendar' | 'table'>('chart');

// Forecasts and transactions with no category share one pair of bars
const NONE_KEY = 'none';

const SERIES: Series[] = [
  { key: 'planned', label: 'Prévu', color: 'var(--series-1)' },
  { key: 'actual', label: 'Réalisé', color: 'var(--series-2)' },
];
const config: ChartConfig = Object.fromEntries(SERIES.map((s) => [s.key, { label: s.label, color: s.color }]));

// One row per category of the side shown, with a forecast or an actual amount
// this month, biggest forecast first (the order of lib/budget.ts): its two
// bars side by side
const rows = computed<Row[]>(() => {
  const byKey = new Map<string, Row>();
  for (const r of budget(props.projections, props.transactions, props.categories, selected.value)[kind.value]) {
    const none = r.uncategorized || !props.categories.some((c) => c._id === r.key);
    const key = none ? NONE_KEY : r.key;
    let row = byKey.get(key);
    if (!row)
      byKey.set(key, (row = { label: none ? 'Sans catégorie' : r.label, t: byKey.size, planned: 0, actual: 0 }));
    row.planned = Number(row.planned) + r.plannedCents;
    // A refund bigger than the month's spending would go below zero
    row.actual = Number(row.actual) + Math.max(0, r.actualCents);
  }
  return [...byKey.values()];
});

// A little room above the highest bar, so its rounded top is not cut off
const yDomain = computed<[number, number]>(() => [
  0,
  Math.max(1, ...rows.value.flatMap((r) => SERIES.map((s) => Number(r[s.key] ?? 0)))) * 1.1,
]);
const y = SERIES.map((s) => (d: Row) => Number(d[s.key] ?? 0));
// Spending above its forecast turns red
const color = computed(
  () => (d: Row, i: number) =>
    i === 1 && kind.value === 'expense' && Number(d.actual) > Number(d.planned)
      ? 'var(--destructive)'
      : SERIES[i]?.color,
);
const tickValues = computed(() => rows.value.map((_, i) => i));
const tickLabel = (i: number) => rows.value[Math.round(i)]?.label ?? '';

const triggers = { [GroupedBar.selectors.bar]: tooltipTemplate(() => config) };

// The budget card's arrows go anywhere: the calendar's too
const now = currentMonth();
const calendarMin = addMonths(now, -120);
const calendarMax = addMonths(now, 120);
</script>

<template>
  <Tabs v-model="view" class="gap-3">
    <div class="flex flex-wrap items-center gap-2">
      <div class="mr-auto">
        <h3 class="text-sm font-medium first-letter:uppercase">Prévu vs réalisé · {{ monthLabel(selected) }}</h3>
        <p v-if="view !== 'calendar'" class="text-sm text-muted-foreground">Par catégorie : prévu, puis réalisé.</p>
        <p v-else class="text-sm text-muted-foreground">Clique sur une prévision pour la modifier.</p>
      </div>
      <OptionSelect v-if="view !== 'calendar'" v-model="kind" :options="KINDS" class="w-32" />
      <TabsList>
        <TabsTrigger value="chart">Graphique</TabsTrigger>
        <TabsTrigger value="calendar">Calendrier</TabsTrigger>
        <TabsTrigger value="table">Tableau</TabsTrigger>
      </TabsList>
    </div>
    <TabsContent value="chart">
      <p v-if="rows.length === 0" class="py-12 text-center text-sm text-muted-foreground">
        Aucune {{ kind === 'expense' ? 'dépense' : 'rentrée' }} prévue ni réalisée ce mois-ci.
      </p>
      <ChartContainer v-else :config="config" class="aspect-auto h-auto [&_[data-vis-xy-container]]:h-64">
        <VisXYContainer :data="rows" :y-domain="yDomain" :margin="{ left: 8, right: 8 }">
          <VisGroupedBar
            :x="(_: Row, i: number) => i"
            :y="y"
            :color="color"
            :group-max-width="56"
            :group-padding="0.25"
            :bar-padding="0.08"
            :rounded-corners="4"
          />
          <VisAxis
            type="x"
            :tick-format="tickLabel"
            :tick-values="tickValues"
            tick-text-fit-mode="trim"
            :tick-text-width="96"
            tick-text-hide-overlapping
            :grid-line="false"
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
    <TabsContent value="calendar">
      <ProjectionCalendar
        v-model="selected"
        :projections="projections"
        :min="calendarMin"
        :max="calendarMax"
        @edit="emit('edit', $event)"
      />
    </TabsContent>
    <TabsContent value="table">
      <SeriesTable :rows="rows" :series="SERIES" bucket-label="Catégorie" />
    </TabsContent>
  </Tabs>
</template>
