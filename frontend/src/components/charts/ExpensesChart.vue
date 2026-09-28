<script setup lang="ts">
// Spending per bucket (week or month), stacked by category
import type { ChartConfig } from '@/components/ui/chart';
import type { Row, Series } from '@/lib/chartData';
import { computed } from 'vue';
import { StackedBar } from '@unovis/ts';
import { VisAxis, VisStackedBar, VisTooltip, VisXYContainer } from '@unovis/vue';
import { formatCentsCompact } from '@/api';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartLegendContent } from '@/components/ui/chart';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
}>();

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
const tickLabel = (i: number) => {
  const row = props.rows[Math.round(i)];
  return row ? (props.formatTick?.(row) ?? row.label) : '';
};

const triggers = {
  [StackedBar.selectors.bar]: tooltipTemplate(() => config.value, { hideZero: true, showTotal: true }),
};
</script>

<template>
  <Card>
    <Tabs default-value="chart" class="gap-6">
      <CardHeader>
        <CardTitle>{{ title }}</CardTitle>
        <CardDescription>{{ description }}</CardDescription>
        <CardAction>
          <TabsList>
            <TabsTrigger value="chart">Graphique</TabsTrigger>
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
            <ChartContainer :config="config" class="aspect-auto h-72">
              <VisXYContainer :data="rows" :margin="{ left: 8, right: 8 }">
                <VisStackedBar
                  :x="(_: Row, i: number) => i"
                  :y="y"
                  :color="color"
                  :bar-max-width="24"
                  :rounded-corners="4"
                  :bar-padding="0.2"
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
          <TabsContent value="table">
            <SeriesTable :rows="rows" :series="series" :bucket-label="bucketLabel" show-total />
          </TabsContent>
        </template>
      </CardContent>
    </Tabs>
  </Card>
</template>
