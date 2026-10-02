<script setup lang="ts">
// Projections of the month picked in the next 12 months chart: its net, then
// the chart. "Gérer les prévisions" lists them all, to edit or delete.
import type { Category, Projection } from '@/types';
import type { Month } from '@/lib/projections';
import { computed, defineAsyncComponent, ref } from 'vue';
import { Plus, RotateCcw } from '@lucide/vue';
import { api, formatCents } from '@/api';
import { currentMonth, monthLabel, occurrences, sameMonth, totals } from '@/lib/projections';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ProjectionDialog from './ProjectionDialog.vue';
import ProjectionListDialog from './ProjectionListDialog.vue';

// Charts pull in Unovis (~1 MB): load them in their own chunk
const ProjectionsChart = defineAsyncComponent(() => import('./charts/ProjectionsChart.vue'));

const month = defineModel<Month>({ required: true });
const props = defineProps<{
  projections: Projection[];
  categories: Category[];
}>();
const emit = defineEmits<{ changed: []; error: [message: string] }>();

const now = currentMonth();
const isCurrent = computed(() => sameMonth(month.value, now));

const sums = computed(() => totals(occurrences(props.projections, month.value)));

// Dialog listing them all
const listOpen = ref(false);

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
      <CardTitle class="flex min-h-8 items-center gap-1 text-lg">
        <span class="first-letter:uppercase">{{ monthLabel(month) }}</span>
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
      </CardTitle>
      <CardAction class="flex flex-wrap items-center justify-end gap-2">
        <Button v-if="projections.length > 0" variant="link" @click="listOpen = true">Gérer les prévisions</Button>
        <Button @click="openDialog(null)">
          <Plus />
          Prévision
        </Button>
      </CardAction>
    </CardHeader>
    <CardContent class="flex flex-col gap-4">
      <div class="rounded-lg border p-4">
        <div class="text-sm text-muted-foreground">Net</div>
        <div
          class="text-3xl font-semibold tabular-nums"
          :class="sums.netCents < 0 ? 'text-destructive' : sums.netCents > 0 ? 'text-emerald-600' : ''"
        >
          {{ formatCents(sums.netCents) }}
        </div>
        <dl class="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <div class="flex gap-1.5">
            <dt class="text-muted-foreground">À recevoir</dt>
            <dd class="tabular-nums text-emerald-600">{{ formatCents(sums.incomeCents) }}</dd>
          </div>
          <div class="flex gap-1.5">
            <dt class="text-muted-foreground">Dépenses prévues</dt>
            <dd class="tabular-nums text-destructive">{{ formatCents(-sums.expenseCents) }}</dd>
          </div>
        </dl>
      </div>

      <!-- Picks the month shown above it -->
      <ProjectionsChart
        v-if="projections.length > 0"
        v-model="month"
        :projections="projections"
        :categories="categories"
        @edit="openDialog"
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
