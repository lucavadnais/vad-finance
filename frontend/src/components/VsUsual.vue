<script setup lang="ts">
// Spending against the usual by the same day (see lib/spending.ts), as a
// sentence: red above it, green below, "Comme d'habitude" within a few
// percent. The home's spending tile, and the spending tab's chart legend
// (`dot`: the gray dot of the chart's median line before "d'habitude").
import { ArrowDown, ArrowUp } from '@lucide/vue';

withDefaults(defineProps<{ percent: number; dot?: boolean; align?: 'start' | 'end' }>(), {
  dot: false,
  align: 'start',
});
</script>

<template>
  <span class="flex flex-col text-sm" :class="align === 'end' ? 'items-end' : 'items-start'">
    <span v-if="Math.abs(percent) < 3" class="flex items-center gap-1.5 text-muted-foreground">
      <span v-if="dot" class="size-2.5 rounded-full bg-[var(--brand-gray)]" />
      Comme d'habitude
    </span>
    <template v-else>
      <span
        class="flex items-center gap-1 font-medium tabular-nums"
        :class="percent > 0 ? 'text-destructive' : 'text-emerald-600'"
      >
        <ArrowUp v-if="percent > 0" class="size-4 shrink-0" />
        <ArrowDown v-else class="size-4 shrink-0" />
        {{ Math.abs(percent) }} % de {{ percent > 0 ? 'plus' : 'moins' }}
      </span>
      <span class="flex items-center gap-1.5 text-muted-foreground">
        <span v-if="dot" class="size-2.5 rounded-full bg-[var(--brand-gray)]" />
        que d'habitude
      </span>
    </template>
  </span>
</template>
