<script setup lang="ts">
// Planning of a month: the forecasts vs actual chart by category, and the
// forecasts themselves ("Gérer les prévisions" lists them all, to edit or
// delete). The month's figures (net, income, spending) are in the month card
// (SpendInsights), which shares the month and opens the forecasts through
// `openDialog`.
import type { Category, Projection, Transaction } from '@/types';
import type { Month } from '@/lib/projections';
import { defineAsyncComponent, ref } from 'vue';
import { ListChecks, Plus } from '@lucide/vue';
import { api } from '@/api';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ProjectionDialog from './ProjectionDialog.vue';
import ProjectionList from './ProjectionList.vue';
import ProjectionListDialog from './ProjectionListDialog.vue';
import PageBar from './PageBar.vue';

// Charts pull in Unovis (~1 MB): load them in their own chunk
const ProjectionsChart = defineAsyncComponent(() => import('./charts/ProjectionsChart.vue'));

const month = defineModel<Month>({ required: true });
defineProps<{
  projections: Projection[];
  transactions: Transaction[];
  categories: Category[];
}>();
const emit = defineEmits<{ changed: []; error: [message: string] }>();

// Dialog listing them all
const listOpen = ref(false);

// Dialog adding a projection, or editing `editing`
const dialogOpen = ref(false);
const editing = ref<Projection | null>(null);

function openDialog(p: Projection | null) {
  editing.value = p;
  dialogOpen.value = true;
}

defineExpose({ openDialog });

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
  <!-- A card on a computer; flat in its tab on a phone, like the others -->
  <Card class="max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:py-0 max-md:shadow-none">
    <!-- Computer: the title and the actions. The month is set by the month card
         above (SpendInsights) -->
    <CardHeader class="max-md:hidden">
      <CardTitle class="flex min-h-8 items-center text-lg">Budget</CardTitle>
      <CardAction class="flex items-center gap-2">
        <Button v-if="projections.length > 0" variant="ghost" @click="listOpen = true">
          <ListChecks />
          Gérer les prévisions
        </Button>
        <Button @click="openDialog(null)">
          <Plus />
          Prévision
        </Button>
      </CardAction>
    </CardHeader>
    <!-- Phone: the page's bar, with the month (the actions are by the list) -->
    <PageBar v-model:month="month" title="Budget" class="md:hidden" />
    <CardContent class="flex flex-col gap-4 max-md:px-0">
      <!-- Forecasts vs actual by category, for the month shown -->
      <ProjectionsChart
        v-if="projections.length > 0"
        v-model="month"
        :projections="projections"
        :transactions="transactions"
        :categories="categories"
        @edit="openDialog"
      />

      <!-- Phone: the list right under the chart, instead of its dialog, with the
           button to add one top right -->
      <section class="flex flex-col gap-3 border-t pt-4 md:hidden">
        <div class="flex items-center justify-between gap-2">
          <h3 class="text-sm font-medium">Prévisions</h3>
          <Button
            size="icon"
            aria-label="Ajouter une prévision"
            title="Ajouter une prévision"
            @click="openDialog(null)"
          >
            <Plus />
          </Button>
        </div>
        <ProjectionList :projections="projections" :categories="categories" @edit="openDialog" @remove="remove" />
      </section>

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
