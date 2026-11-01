<script setup lang="ts">
// Spending by category over the period: the share of each one as a donut, or
// (computer) a table per bucket (week or month)
import type { ChartSelection, Row, Series } from '@/lib/chartData';
import type { Transaction } from '@/types';
import { ref, watch } from 'vue';
import { useMediaQuery } from '@vueuse/core';
import { ChartPie } from '@lucide/vue';
import { CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import EmptyState from '../EmptyState.vue';
import ExpensesDonut from './ExpensesDonut.vue';
import SelectedTransactions from './SelectedTransactions.vue';
import SeriesTable from './SeriesTable.vue';

const props = defineProps<{
  title: string;
  description: string;
  rows: Row[];
  series: Series[];
  bucketLabel: string;
  // The clicked slice and its transactions, shown in a dialog
  selection: ChartSelection | null;
  selectedTransactions: Transaction[];
  // The share only, no views to pick (a single month: no buckets to compare)
  shareOnly?: boolean;
  // Written when there is no spending (e.g. a month to come)
  emptyMessage?: string;
}>();
const emit = defineEmits<{ select: [selection: ChartSelection | null] }>();

// The share of each category first: the most telling view of a period. A
// phone has no table, the share only
const phone = useMediaQuery('(max-width: 767px)');
const view = ref<'share' | 'table'>('share');
watch(
  () => props.shareOnly || phone.value,
  (only) => only && (view.value = 'share'),
);

// Clicking the same slice again closes the list
function select(selection: ChartSelection) {
  const same = props.selection?.keys.join() === selection.keys.join();
  emit('select', same ? null : selection);
}
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
          <!-- The parent's description is about the table (by week, month...);
               the donut is the whole period -->
          <CardDescription>
            {{ view === 'share' ? 'Part de chaque catégorie dans les dépenses de la période.' : description }}
          </CardDescription>
        </div>
        <!-- Beside the title on a computer, under it on a phone -->
        <CardAction
          stack
          class="flex flex-wrap items-center gap-x-4 gap-y-2 max-md:w-full max-md:justify-between @md/card-header:md:justify-end @max-md/card-header:w-full @max-md/card-header:justify-between"
        >
          <!-- Options from the parent for every view (the grouping) -->
          <div v-if="$slots.filters" class="max-md:basis-full @max-md/card-header:basis-full">
            <slot name="filters" />
          </div>
          <!-- Extra controls from the parent (the week / month choice): they
               shape the table, not the share of the period -->
          <slot v-if="view !== 'share'" name="actions" />
          <!-- No table on a phone, so no views to pick there -->
          <TabsList v-if="!shareOnly" class="ml-auto max-md:hidden">
            <TabsTrigger value="share">Répartition</TabsTrigger>
            <TabsTrigger value="table">Tableau</TabsTrigger>
          </TabsList>
        </CardAction>
      </CardHeader>
      <CardContent class="max-md:px-0">
        <EmptyState
          v-if="rows.length === 0"
          :icon="ChartPie"
          :title="emptyMessage ?? 'Aucune dépense sur cette période'"
        />
        <template v-else>
          <TabsContent value="share">
            <ExpensesDonut :rows="rows" :series="series" @select="select" />
          </TabsContent>
          <TabsContent value="table">
            <SeriesTable :rows="rows" :series="series" :bucket-label="bucketLabel" show-total />
          </TabsContent>
        </template>
        <!-- The clicked slice's transactions: the share view, not the table -->
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
