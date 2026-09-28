<script setup lang="ts">
// The transactions behind the clicked bar segment or donut slice
import type { ChartSelection } from '@/lib/chartData';
import type { Transaction } from '@/types';
import { computed } from 'vue';
import { X } from '@lucide/vue';
import { formatCents, formatDate } from '@/api';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const props = defineProps<{ selection: ChartSelection | null; transactions: Transaction[] }>();
const emit = defineEmits<{ close: [] }>();

const total = computed(() => props.transactions.reduce((sum, t) => sum - t.amountCents, 0));
// "Autres" and groups span several categories: show which one each row is in
const showCategory = computed(
  () => new Set(props.transactions.map((t) => t.category?._id ?? null)).size > 1,
);
</script>

<template>
  <Collapsible :open="!!selection">
    <CollapsibleContent>
      <div v-if="selection" class="mt-4 rounded-lg border">
        <div class="flex items-center gap-2 border-b px-4 py-2">
          <span class="font-medium">{{ selection.label }}</span>
          <span class="text-sm text-muted-foreground">
            · {{ transactions.length }} transaction(s) · {{ formatCents(total) }}
          </span>
          <Button size="icon-sm" variant="ghost" class="ml-auto" aria-label="Fermer" @click="emit('close')">
            <X />
          </Button>
        </div>
        <div class="max-h-80 overflow-y-auto">
          <Table>
            <TableHeader class="sticky top-0 bg-background">
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Compte</TableHead>
                <TableHead v-if="showCategory">Catégorie</TableHead>
                <TableHead class="text-right">Montant</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="t in transactions" :key="t._id">
                <TableCell class="whitespace-nowrap">{{ formatDate(t.date) }}</TableCell>
                <TableCell class="whitespace-normal">{{ t.description }}</TableCell>
                <TableCell>{{ t.account?.name }}</TableCell>
                <TableCell v-if="showCategory">{{ t.category?.name ?? 'Sans catégorie' }}</TableCell>
                <TableCell class="text-right tabular-nums text-destructive">
                  {{ formatCents(t.amountCents) }}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </CollapsibleContent>
  </Collapsible>
</template>
