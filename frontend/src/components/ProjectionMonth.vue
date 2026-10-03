<script setup lang="ts">
// Budget of a month: net, income and spending against the forecasts (with the
// detail by category), then the next 12 months chart, which also picks the
// month. "Gérer les prévisions" lists them all, to edit or delete.
import type { Category, Projection, Transaction } from '@/types';
import type { Month } from '@/lib/projections';
import { computed, defineAsyncComponent, ref } from 'vue';
import { ChevronLeft, ChevronRight, ListChecks, Plus, RotateCcw } from '@lucide/vue';
import { api } from '@/api';
import { addMonths, currentMonth, monthLabel, sameMonth } from '@/lib/projections';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import BudgetSummary from './BudgetSummary.vue';
import ProjectionDialog from './ProjectionDialog.vue';
import ProjectionListDialog from './ProjectionListDialog.vue';

// Charts pull in Unovis (~1 MB): load them in their own chunk
const ProjectionsChart = defineAsyncComponent(() => import('./charts/ProjectionsChart.vue'));

const month = defineModel<Month>({ required: true });
defineProps<{
  projections: Projection[];
  transactions: Transaction[];
  categories: Category[];
}>();
const emit = defineEmits<{ changed: []; error: [message: string] }>();

const now = currentMonth();
const isCurrent = computed(() => sameMonth(month.value, now));

// Dialog listing them all
const listOpen = ref(false);

// Side of the budget shown by category; picking a month in the chart opens
// the spending if none is
const expanded = ref<'income' | 'expense' | null>(null);

// Dialog adding a projection, or editing `editing`
const dialogOpen = ref(false);
const editing = ref<Projection | null>(null);

function openDialog(p: Projection | null) {
  editing.value = p;
  dialogOpen.value = true;
}

async function remove(p: Projection) {
  try {
    await api.deleteProjection(p._id);
    emit('changed');
  } catch (err) {
    emit('error', (err as Error).message);
  }
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="flex min-h-8 flex-wrap items-center gap-1 text-lg">
        Budget
        <span class="ml-2 flex items-center gap-1 text-sm font-medium">
          <Button size="icon-sm" variant="ghost" aria-label="Mois précédent" @click="month = addMonths(month, -1)">
            <ChevronLeft />
          </Button>
          <span class="min-w-28 text-center first-letter:uppercase">{{ monthLabel(month) }}</span>
          <Button size="icon-sm" variant="ghost" aria-label="Mois suivant" @click="month = addMonths(month, 1)">
            <ChevronRight />
          </Button>
          <Button
            v-if="!isCurrent"
            size="icon-sm"
            variant="ghost"
            aria-label="Revenir au mois courant"
            title="Revenir au mois courant"
            @click="month = now"
          >
            <RotateCcw />
          </Button>
        </span>
      </CardTitle>
      <CardAction class="flex flex-wrap items-center justify-end gap-2">
        <!-- Icons only on a phone, so the header fits next to the month -->
        <Button
          v-if="projections.length > 0"
          variant="ghost"
          aria-label="Gérer les prévisions"
          title="Gérer les prévisions"
          class="max-sm:size-9"
          @click="listOpen = true"
        >
          <ListChecks />
          <span class="max-sm:sr-only">Gérer les prévisions</span>
        </Button>
        <Button aria-label="Ajouter une prévision" class="max-sm:size-9" @click="openDialog(null)">
          <Plus />
          <span class="max-sm:sr-only">Prévision</span>
        </Button>
      </CardAction>
    </CardHeader>
    <CardContent class="flex flex-col gap-4">
      <BudgetSummary
        v-model:expanded="expanded"
        :month="month"
        :projections="projections"
        :transactions="transactions"
        :categories="categories"
        @edit="openDialog"
      />

      <!-- Picks the month shown above it -->
      <ProjectionsChart
        v-if="projections.length > 0"
        v-model="month"
        :projections="projections"
        :categories="categories"
        @edit="openDialog"
        @pick="expanded ??= 'expense'"
      />

      <ProjectionListDialog
        v-model:open="listOpen"
        :projections="projections"
        :categories="categories"
        @edit="openDialog"
        @remove="remove"
      />
      <ProjectionDialog
        v-model:open="dialogOpen"
        :categories="categories"
        :projection="editing"
        @saved="emit('changed')"
      />
    </CardContent>
  </Card>
</template>
