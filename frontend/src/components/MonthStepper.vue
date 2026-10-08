<script setup lang="ts">
// A month picked with arrows: ‹ Octobre 2026 ›, and a button back to the
// current month once away from it. `upToNow` stops at the current month (past
// data only); `shortOnNarrow` abbreviates the month on the narrowest screens,
// where it shares its line with other controls.
import type { Month } from '@/lib/projections';
import { computed } from 'vue';
import { ChevronLeft, ChevronRight, RotateCcw } from '@lucide/vue';
import { addMonths, currentMonth, monthLabel, sameMonth } from '@/lib/projections';
import { Button } from '@/components/ui/button';

const props = defineProps<{ upToNow?: boolean; shortOnNarrow?: boolean }>();
const month = defineModel<Month>({ required: true });

const now = currentMonth();
const isCurrent = computed(() => sameMonth(month.value, now));
</script>

<template>
  <span class="flex min-w-0 items-center gap-1 text-sm font-medium">
    <Button size="icon-sm" variant="ghost" aria-label="Mois précédent" @click="month = addMonths(month, -1)">
      <ChevronLeft />
    </Button>
    <span class="truncate px-1 text-center first-letter:uppercase" :class="!shortOnNarrow && 'min-w-28'">
      <template v-if="shortOnNarrow">
        <span class="min-[400px]:hidden">{{ monthLabel(month, 'short') }}</span>
        <span class="max-[399px]:hidden">{{ monthLabel(month) }}</span>
      </template>
      <template v-else>{{ monthLabel(month) }}</template>
    </span>
    <Button
      size="icon-sm"
      variant="ghost"
      aria-label="Mois suivant"
      :disabled="props.upToNow && isCurrent"
      @click="month = addMonths(month, 1)"
    >
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
</template>
