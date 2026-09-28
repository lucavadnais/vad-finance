<script setup lang="ts">
// Share of each category (or group) in the period's spending, as a donut.
// A donut reads at a glance only with few slices: past MAX_SEGMENTS, the
// smallest ones fold into "Autres". The list beside it carries every value.
import type { ChartConfig } from '@/components/ui/chart';
import type { ChartSelection, Row, Series } from '@/lib/chartData';
import { OTHER_KEY } from '@/lib/chartData';
import { computed } from 'vue';
import { Donut } from '@unovis/ts';
import { VisDonut, VisSingleContainer, VisTooltip } from '@unovis/vue';
import { formatCents } from '@/api';
import { ChartContainer } from '@/components/ui/chart';
import { tooltipTemplate } from './tooltip';

const props = defineProps<{ rows: Row[]; series: Series[] }>();
const emit = defineEmits<{ select: [selection: ChartSelection] }>();

const MAX_SEGMENTS = 6;

interface Segment extends Series {
  value: number;
  // Series keys counted in this slice (several for "Autres")
  keys: string[];
}

const total = computed(() => segments.value.reduce((sum, s) => sum + s.value, 0));

const segments = computed<Segment[]>(() => {
  const withValues = props.series
    .map((s) => ({
      ...s,
      keys: [s.key],
      value: props.rows.reduce((sum, r) => sum + Number(r[s.key] ?? 0), 0),
    }))
    .filter((s) => s.value > 0);
  // The series may already hold an "Autres" (categories past the color slots):
  // it joins the slices folded here, so there is only one "Autres", always last
  const others = withValues.filter((s) => s.key === OTHER_KEY);
  const named = withValues.filter((s) => s.key !== OTHER_KEY).sort((a, b) => b.value - a.value);

  const fits = named.length + (others.length > 0 ? 1 : 0) <= MAX_SEGMENTS;
  const kept = fits ? named : named.slice(0, MAX_SEGMENTS - 1);
  const rest = [...others, ...(fits ? [] : named.slice(MAX_SEGMENTS - 1))];
  if (rest.length === 0) return kept;
  const value = rest.reduce((sum, s) => sum + s.value, 0);
  const keys = rest.flatMap((s) => s.keys);
  return [...kept, { key: OTHER_KEY, label: 'Autres', color: 'var(--series-other)', value, keys }];
});

const percent = (value: number) =>
  total.value > 0 ? `${((value / total.value) * 100).toLocaleString('fr-CA', { maximumFractionDigits: 1 })} %` : '';

// The tooltip body shows the keys of the config found in the hovered row
const config = computed<ChartConfig>(() =>
  Object.fromEntries(segments.value.map((s) => [s.key, { label: s.label, color: s.color }])),
);
const tooltipRow = (s: Segment) => ({ label: `${percent(s.value)} des dépenses`, [s.key]: s.value });
const events = {
  [Donut.selectors.segment]: {
    click: (d: { data: Segment }) => emit('select', { keys: d.data.keys, label: d.data.label }),
  },
};
const triggers = {
  [Donut.selectors.segment]: (d: { data: Segment }) =>
    tooltipTemplate(() => config.value, { hideZero: true })(tooltipRow(d.data)),
};
</script>

<template>
  <div class="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
    <ChartContainer :config="config" class="aspect-square h-64 w-64 shrink-0">
      <VisSingleContainer :data="segments">
        <VisDonut
          :value="(s: Segment) => s.value"
          :color="(s: Segment) => s.color"
          :arc-width="36"
          :pad-angle="0.02"
          :corner-radius="4"
          :central-label="formatCents(total)"
          central-sub-label="Total"
          :sort-function="() => 0"
          :events="events"
        />
        <VisTooltip :triggers="triggers" />
      </VisSingleContainer>
    </ChartContainer>

    <!-- Legend with every value: identity never rests on color alone -->
    <ul class="flex w-full flex-col gap-2 text-sm">
      <li
        v-for="s in segments"
        :key="s.key"
        class="-mx-2 flex cursor-pointer items-center gap-2 rounded-md px-2 py-0.5 hover:bg-muted"
        role="button"
        tabindex="0"
        @click="emit('select', { keys: s.keys, label: s.label })"
        @keydown.enter.space.prevent="emit('select', { keys: s.keys, label: s.label })"
      >
        <span class="size-2.5 shrink-0 rounded-xs" :style="{ background: s.color }" />
        <span class="flex-1">{{ s.label }}</span>
        <span class="font-medium tabular-nums">{{ formatCents(s.value) }}</span>
        <span class="w-14 text-right text-muted-foreground tabular-nums">{{ percent(s.value) }}</span>
      </li>
    </ul>
  </div>
</template>
