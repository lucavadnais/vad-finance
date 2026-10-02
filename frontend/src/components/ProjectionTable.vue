<script setup lang="ts">
// Projections, one row each: name, category and recurrence, a date column and
// an amount. With `editable`, each row can be edited or deleted.
import type { Category, Projection } from '@/types';
import { Pencil, Trash2 } from '@lucide/vue';
import { formatCents } from '@/api';
import { recurrenceLabel } from '@/lib/projections';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

export interface ProjectionRow {
  projection: Projection;
  // The date column, or null to show it as over
  date: string | null;
  // Positive for an amount to receive, negative for an expense
  signedCents: number;
  // Shown under the amount, e.g. "4 × 100,00 $"
  detail?: string;
}

const props = withDefaults(
  defineProps<{
    rows: ProjectionRow[];
    categories: Category[];
    dateLabel: string;
    editable?: boolean;
    empty?: string;
  }>(),
  { editable: false, empty: 'Aucune prévision' },
);
const emit = defineEmits<{ edit: [projection: Projection]; remove: [projection: Projection] }>();

const categoryName = (id: string | null) => props.categories.find((c) => c._id === id)?.name;
</script>

<template>
  <Table>
    <TableHeader class="sticky top-0 z-10 bg-background">
      <TableRow>
        <TableHead>Nom</TableHead>
        <TableHead>{{ dateLabel }}</TableHead>
        <TableHead class="text-right">Montant</TableHead>
        <TableHead v-if="editable" />
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow v-for="r in rows" :key="r.projection._id" :class="!r.date && 'text-muted-foreground'">
        <TableCell class="whitespace-normal">
          <span class="font-medium">{{ r.projection.name }}</span>
          <Badge v-if="categoryName(r.projection.category)" variant="outline" class="ml-2 whitespace-normal">
            {{ categoryName(r.projection.category) }}
          </Badge>
          <div class="text-xs text-muted-foreground">{{ recurrenceLabel(r.projection) }}</div>
        </TableCell>
        <TableCell class="tabular-nums">
          <template v-if="r.date">{{ r.date }}</template>
          <Badge v-else variant="secondary">Terminée</Badge>
        </TableCell>
        <TableCell class="text-right tabular-nums">
          <div :class="r.signedCents < 0 ? 'text-destructive' : 'text-emerald-600'">
            {{ formatCents(r.signedCents) }}
          </div>
          <div v-if="r.detail" class="text-xs text-muted-foreground">{{ r.detail }}</div>
        </TableCell>
        <TableCell v-if="editable" class="w-0 text-right whitespace-nowrap">
          <Button
            size="icon-sm"
            variant="ghost"
            :aria-label="`Modifier ${r.projection.name}`"
            @click="emit('edit', r.projection)"
          >
            <Pencil />
          </Button>
          <ConfirmDialog :title="`Supprimer « ${r.projection.name} » ?`" @confirm="emit('remove', r.projection)">
            <Button size="icon-sm" variant="ghost" :aria-label="`Supprimer ${r.projection.name}`">
              <Trash2 />
            </Button>
          </ConfirmDialog>
        </TableCell>
      </TableRow>
      <TableEmpty v-if="rows.length === 0" :colspan="editable ? 4 : 3">{{ empty }}</TableEmpty>
    </TableBody>
  </Table>
</template>
