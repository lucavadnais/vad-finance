<script setup lang="ts">
// Balance over time: the total, or one line per account
import type { ChartConfig } from '@/components/ui/chart';
import type { Row, Series } from '@/lib/chartData';
import { computed, ref } from 'vue';
import { CurveType } from '@unovis/ts';
import { VisArea, VisAxis, VisCrosshair, VisLine, VisTooltip, VisXYContainer } from '@unovis/vue';
import { amountTickFormat } from '@/api';
import { TOTAL_SERIES } from '@/lib/chartData';
import { CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartLegendContent } from '@/components/ui/chart';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SeriesTable from './SeriesTable.vue';
import { tooltipTemplate } from './tooltip';

const props = defineProps<{ rows: Row[]; accountSeries: Series[] }>();

const mode = ref<'total' | 'accounts'>('total');
const series = computed(() => (mode.value === 'total' ? [TOTAL_SERIES] : props.accountSeries));

const config = computed<ChartConfig>(() =>
  Object.fromEntries(series.value.map((s) => [s.key, { label: s.label, color: s.color }])),
);

const x = (d: Row) => d.t;
const y = computed(() => series.value.map((s) => (d: Row) => Number(d[s.key] ?? 0)));
const color = computed(() => series.value.map((s) => s.color));

const formatDay = (t: number) =>
  new Date(t).toLocaleDateString('fr-CA', { timeZone: 'UTC', day: 'numeric', month: 'short' });
const formatRowDate = (row: Row) => new Date(row.t).toLocaleDateString('fr-CA', { timeZone: 'UTC' });

const template = tooltipTemplate(() => config.value, { dateLabel: true, showTotal: false });
</script>

<template>
  <!-- Rendered inside the analysis card (DashboardCharts) -->
  <section>
    <Tabs default-value="chart" class="gap-6">
      <CardHeader>
        <CardTitle>Fluctuation du solde</CardTitle>
        <CardDescription>
          {{ mode === 'total' ? 'Solde total de tous les comptes' : 'Solde de chaque compte' }}, après chaque journée de
          transactions.
        </CardDescription>
        <CardAction class="flex flex-wrap justify-end gap-2">
          <Tabs v-model="mode">
            <TabsList>
              <TabsTrigger value="total">Total</TabsTrigger>
              <TabsTrigger value="accounts">Par compte</TabsTrigger>
            </TabsList>
          </Tabs>
          <TabsList>
            <TabsTrigger value="chart">Graphique</TabsTrigger>
            <TabsTrigger value="table">Tableau</TabsTrigger>
          </TabsList>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p v-if="rows.length === 0" class="py-12 text-center text-sm text-muted-foreground">
          Aucune transaction sur cette période.
        </p>
        <template v-else>
          <TabsContent value="chart">
            <ChartContainer :config="config" cursor class="aspect-auto h-auto [&_[data-vis-xy-container]]:h-72">
              <VisXYContainer :data="rows" :margin="{ left: 8, right: 8 }">
                <VisArea
                  v-if="mode === 'total'"
                  :x="x"
                  :y="y[0]"
                  :color="TOTAL_SERIES.color"
                  :opacity="0.1"
                  :curve-type="CurveType.StepAfter"
                />
                <VisLine :x="x" :y="y" :color="color" :line-width="2" :curve-type="CurveType.StepAfter" />
                <VisAxis type="x" :tick-format="formatDay" :num-ticks="6" :grid-line="false" :tick-line="false" />
                <VisAxis
                  type="y"
                  :tick-format="amountTickFormat"
                  :num-ticks="4"
                  :domain-line="false"
                  :tick-line="false"
                />
                <VisTooltip />
                <VisCrosshair :template="template" :color="color" />
              </VisXYContainer>
              <ChartLegendContent v-if="series.length > 1" />
            </ChartContainer>
          </TabsContent>
          <TabsContent value="table">
            <SeriesTable
              :rows="[...rows].reverse()"
              :series="series"
              bucket-label="Date"
              :format-bucket="formatRowDate"
              :show-total="mode === 'accounts'"
            />
          </TabsContent>
        </template>
      </CardContent>
    </Tabs>
  </section>
</template>
