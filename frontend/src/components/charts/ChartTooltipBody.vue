<script setup lang="ts">
// Tooltip content rendered by componentToString (see ui/chart/utils.ts):
// receives the hovered row as `payload`. Values lead, series names follow,
// each keyed by a short stroke of the series color.
import type { ChartConfig } from '@/components/ui/chart';
import { computed } from 'vue';
import { formatCents } from '@/api';

const props = withDefaults(
  defineProps<{
    payload?: Record<string, unknown>;
    config?: ChartConfig;
    x?: number | Date;
    // Bucketed bars skip empty series; balance lines show every account
    hideZero?: boolean;
    showTotal?: boolean;
    dateLabel?: boolean;
  }>(),
  { payload: () => ({}), config: () => ({}) },
);

const rows = computed(() =>
  Object.entries(props.config)
    .map(([key, item]) => ({
      key,
      label: item.label as string,
      color: item.color,
      value: Number(props.payload[key] ?? 0),
    }))
    .filter((r) => !props.hideZero || r.value !== 0),
);

const title = computed(() => {
  if (props.dateLabel) {
    return new Date(Number(props.payload.t)).toLocaleDateString('fr-CA', {
      timeZone: 'UTC',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }
  return String(props.payload.label ?? '');
});

const total = computed(() => rows.value.reduce((sum, r) => sum + r.value, 0));
</script>

<template>
  <div class="grid min-w-44 gap-1.5 rounded-lg border bg-background px-3 py-2 text-xs shadow-xl">
    <div class="font-medium">{{ title }}</div>
    <div v-for="r in rows" :key="r.key" class="flex items-center gap-2">
      <span class="h-0.5 w-3 shrink-0 rounded-full" :style="{ background: r.color }" />
      <span class="font-semibold tabular-nums text-foreground">{{ formatCents(r.value) }}</span>
      <span class="text-muted-foreground">{{ r.label }}</span>
    </div>
    <div v-if="showTotal && rows.length > 1" class="flex items-center gap-2 border-t pt-1.5">
      <span class="w-3" />
      <span class="font-semibold tabular-nums text-foreground">{{ formatCents(total) }}</span>
      <span class="text-muted-foreground">Total</span>
    </div>
  </div>
</template>
