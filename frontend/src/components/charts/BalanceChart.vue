<script setup lang="ts">
// The total balance over the period, laid out like an account's page: the
// balance today in big, how much it moved over the period beside it, then its
// curve. Or, as a table, the balance after each day.
import type { Row } from '@/lib/chartData';
import { computed } from 'vue';
import { ChartLine, Table2 } from '@lucide/vue';
import { formatCents } from '@/api';
import { TOTAL_SERIES } from '@/lib/chartData';
import { CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TrendChart from '../TrendChart.vue';
import SeriesTable from './SeriesTable.vue';

const props = defineProps<{ rows: Row[] }>();

// Each row at its date
const times = computed(() => props.rows.map((r) => r.t));
const totals = computed(() => props.rows.map((r) => Number(r.total ?? 0)));
const change = computed(() => (totals.value.at(-1) ?? 0) - (totals.value[0] ?? 0));

const formatRowDate = (row: Row) => new Date(row.t).toLocaleDateString('fr-CA', { timeZone: 'UTC' });
</script>

<template>
  <!-- Rendered inside the analysis card (DashboardCharts) -->
  <!-- Phone: flat, right under the period (the card is flat there too) -->
  <section>
    <Tabs default-value="chart" class="gap-6">
      <CardHeader class="max-md:px-0">
        <CardTitle>Fluctuation du solde</CardTitle>
        <CardDescription>Solde total de tous les comptes, après chaque journée de transactions.</CardDescription>
        <!-- The views top right; icons only on a phone -->
        <CardAction>
          <TabsList>
            <TabsTrigger value="chart" aria-label="Graphique" title="Graphique">
              <ChartLine class="md:hidden" />
              <span class="max-md:sr-only">Graphique</span>
            </TabsTrigger>
            <TabsTrigger value="table" aria-label="Tableau" title="Tableau">
              <Table2 class="md:hidden" />
              <span class="max-md:sr-only">Tableau</span>
            </TabsTrigger>
          </TabsList>
        </CardAction>
      </CardHeader>
      <CardContent class="max-md:px-0">
        <p v-if="rows.length === 0" class="py-12 text-center text-sm text-muted-foreground">
          Aucune transaction sur cette période.
        </p>
        <template v-else>
          <!-- Like an account's page: the balance in big, its change beside it,
               then the curve -->
          <TabsContent value="chart" class="flex flex-col gap-4">
            <div class="flex items-start gap-4">
              <div class="mr-auto min-w-0">
                <p class="text-[clamp(2rem,11vw,3rem)] leading-none font-semibold tracking-tight tabular-nums">
                  {{ formatCents(totals.at(-1) ?? 0) }}
                </p>
                <p class="mt-1 text-sm font-medium text-muted-foreground">Solde actuel</p>
              </div>
              <div class="shrink-0 pt-1 text-right text-sm whitespace-nowrap">
                <p class="text-muted-foreground">Variation</p>
                <p class="font-semibold tabular-nums" :class="change < 0 ? 'text-destructive' : 'text-emerald-600'">
                  {{ change > 0 ? '+' : '' }}{{ formatCents(change) }}
                </p>
              </div>
            </div>
            <TrendChart
              :values="totals"
              :x="times"
              :height="240"
              main-label="Solde"
              class="-mx-4 md:-mx-6 md:[--chart-gutter:24px]"
            />
          </TabsContent>
          <TabsContent value="table">
            <SeriesTable
              :rows="[...rows].reverse()"
              :series="[TOTAL_SERIES]"
              bucket-label="Date"
              :format-bucket="formatRowDate"
            />
          </TabsContent>
        </template>
      </CardContent>
    </Tabs>
  </section>
</template>
