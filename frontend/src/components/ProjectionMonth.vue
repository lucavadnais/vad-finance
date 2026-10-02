<script setup lang="ts">
// Projections of the month picked in the next 12 months chart: its net, the
// chart, then each expense and amount to receive by day, to edit or delete.
// Each one is past, today or to come (always to come in a later month).
import type { Category, Projection } from '@/types';
import type { Month } from '@/lib/projections';
import { computed, defineAsyncComponent, ref } from 'vue';
import { Pencil, Plus, RotateCcw, Trash2 } from '@lucide/vue';
import { api, formatCents } from '@/api';
import {
  currentMonth,
  monthLabel,
  occurrences,
  recurrenceLabel,
  sameMonth,
  totals,
} from '@/lib/projections';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import ConfirmDialog from './ConfirmDialog.vue';
import ProjectionDialog from './ProjectionDialog.vue';

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
const today = new Date().getUTCDate();

const list = computed(() => occurrences(props.projections, month.value));
const sums = computed(() => totals(list.value));

const categoryName = (id: string | null) => props.categories.find((c) => c._id === id)?.name;

// Only the current and later months can be shown (the chart starts now)
function status(day: number) {
  if (!isCurrent.value) return { label: 'À venir', variant: 'outline' as const };
  if (day < today) return { label: 'Passée', variant: 'secondary' as const };
  if (day === today) return { label: "Aujourd'hui", variant: 'default' as const };
  return { label: 'À venir', variant: 'outline' as const };
}

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
      <CardAction>
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

      <!-- Picks the month shown above and below it -->
      <ProjectionsChart v-if="projections.length > 0" v-model="month" :projections="projections" />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead class="w-16">Jour</TableHead>
            <TableHead>Nom</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead class="text-right">Prévu</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="o in list"
            :key="o.projection._id"
            :class="isCurrent && o.day < today && 'text-muted-foreground'"
          >
            <TableCell class="tabular-nums">{{ o.day }}</TableCell>
            <TableCell>
              <span class="font-medium">{{ o.projection.name }}</span>
              <Badge v-if="categoryName(o.projection.category)" variant="outline" class="ml-2">
                {{ categoryName(o.projection.category) }}
              </Badge>
              <div class="text-xs text-muted-foreground">{{ recurrenceLabel(o.projection) }}</div>
            </TableCell>
            <TableCell>
              <Badge :variant="status(o.day).variant">{{ status(o.day).label }}</Badge>
            </TableCell>
            <TableCell
              class="text-right tabular-nums"
              :class="o.signedCents < 0 ? 'text-destructive' : 'text-emerald-600'"
            >
              {{ formatCents(o.signedCents) }}
            </TableCell>
            <TableCell class="w-0 text-right whitespace-nowrap">
              <Button
                size="icon-sm"
                variant="ghost"
                :aria-label="`Modifier ${o.projection.name}`"
                @click="openDialog(o.projection)"
              >
                <Pencil />
              </Button>
              <ConfirmDialog :title="`Supprimer « ${o.projection.name} » ?`" @confirm="remove(o.projection)">
                <Button size="icon-sm" variant="ghost" :aria-label="`Supprimer ${o.projection.name}`">
                  <Trash2 />
                </Button>
              </ConfirmDialog>
            </TableCell>
          </TableRow>
          <TableEmpty v-if="list.length === 0" :colspan="5">Rien de prévu ce mois-là</TableEmpty>
        </TableBody>
      </Table>
      <ProjectionDialog
        v-model:open="dialogOpen"
        :categories="categories"
        :projection="editing"
        @saved="emit('changed')"
      />
    </CardContent>
  </Card>
</template>
