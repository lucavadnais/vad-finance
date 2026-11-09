<script lang="ts">
export interface HistoryItem {
  id: string;
  title: string;
  // ISO date
  date: string;
  amountCents: number;
  // Shown green with a "+"
  positive?: boolean;
}
</script>

<script setup lang="ts">
// A dialog's "Historique": what made up a goal (money put aside or taken
// back, a debt's prepayments), the newest first, each with its title, date,
// amount and a bin to remove it (emits `remove` with its id).
import { Trash2 } from '@lucide/vue';
import { formatCents, formatDate } from '@/api';
import { Button } from '@/components/ui/button';

defineProps<{ items: HistoryItem[]; removeLabel: string; disabled?: boolean }>();
const emit = defineEmits<{ remove: [id: string] }>();
</script>

<template>
  <section v-if="items.length > 0" class="flex flex-col gap-1">
    <h3 class="text-sm font-medium">Historique</h3>
    <ul class="flex flex-col divide-y text-sm">
      <li v-for="item in items" :key="item.id" class="flex items-center gap-3 py-2">
        <span class="flex min-w-0 flex-1 flex-col">
          <span class="truncate">{{ item.title }}</span>
          <span class="text-xs text-muted-foreground">{{ formatDate(item.date) }}</span>
        </span>
        <span class="tabular-nums" :class="item.positive && 'text-emerald-600'">
          {{ item.positive ? '+' : '' }}{{ formatCents(item.amountCents) }}
        </span>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          :disabled="disabled"
          :aria-label="removeLabel"
          :title="removeLabel"
          @click="emit('remove', item.id)"
        >
          <Trash2 />
        </Button>
      </li>
    </ul>
  </section>
</template>
