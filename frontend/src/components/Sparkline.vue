<script setup lang="ts">
// A small trend line with no axes, filling its box: the home tiles' charts.
// `length` spreads the values over more slots than they fill (the days of a
// month that has not ended yet).
import { computed, useTemplateRef } from 'vue';
import { useElementSize } from '@vueuse/core';
import { monotonePath } from '@/lib/spending';

const props = withDefaults(defineProps<{ values: number[]; length?: number; color?: string }>(), {
  length: undefined,
  color: 'var(--brand-gray)',
});

const box = useTemplateRef('box');
const { width, height } = useElementSize(box);

const points = computed(() => {
  const min = Math.min(...props.values);
  const range = Math.max(...props.values) - min || 1;
  const slots = Math.max(1, (props.length ?? props.values.length) - 1);
  // A little room above and below so the stroke is not cut off
  return props.values.map(
    (v, i) => [(i / slots) * width.value, 4 + (1 - (v - min) / range) * (height.value - 8)] as const,
  );
});
const line = computed(() => monotonePath(points.value));
const area = computed(() => {
  const last = points.value.at(-1);
  return last ? `${line.value}L${last[0]},${height.value}L0,${height.value}Z` : '';
});
</script>

<template>
  <div ref="box" class="w-full">
    <svg v-if="width && values.length > 1" :width="width" :height="height" class="block" aria-hidden="true">
      <path :d="area" :fill="color" fill-opacity="0.12" />
      <path :d="line" fill="none" :stroke="color" stroke-width="2" stroke-linejoin="round" />
    </svg>
  </div>
</template>
