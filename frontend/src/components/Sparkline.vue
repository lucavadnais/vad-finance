<script setup lang="ts">
// A small trend line with no axes, filling its box: the home tiles' charts.
// `length` spreads the values over more slots than they fill (the days of a
// month that has not ended yet): the line then ends on a dot, its area fading
// out before it, instead of stopping on a hard edge.
import { computed, useId, useTemplateRef } from 'vue';
import { useElementSize } from '@vueuse/core';
import { monotonePath } from '@/lib/spending';

const props = withDefaults(defineProps<{ values: number[]; length?: number; color?: string }>(), {
  length: undefined,
  color: 'var(--brand-gray)',
});

const box = useTemplateRef('box');
// The area fades out downwards (and before an unfinished end), so it does not
// end on a hard edge
const id = useId();
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
// Where the line stops short of the right edge (null when it reaches it)
const end = computed(() => {
  const last = points.value.at(-1);
  return last && last[0] < width.value - 1 ? last : null;
});
const fade = computed(() => (end.value ? Math.min(32, end.value[0] / 2) : 0));
</script>

<template>
  <div ref="box" class="w-full">
    <svg v-if="width && values.length > 1" :width="width" :height="height" class="block" aria-hidden="true">
      <defs>
        <linearGradient :id="`${id}-fill`" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" :stop-color="color" stop-opacity="0.2" />
          <stop offset="1" :stop-color="color" stop-opacity="0" />
        </linearGradient>
        <template v-if="end">
          <linearGradient
            :id="`${id}-end`"
            gradientUnits="userSpaceOnUse"
            :x1="end[0] - fade"
            :x2="end[0]"
            y1="0"
            y2="0"
          >
            <stop offset="0" stop-color="white" />
            <stop offset="1" stop-color="black" />
          </linearGradient>
          <mask :id="`${id}-mask`">
            <rect :width="width" :height="height" :fill="`url(#${id}-end)`" />
          </mask>
        </template>
      </defs>
      <path :d="area" :fill="`url(#${id}-fill)`" :mask="end ? `url(#${id}-mask)` : undefined" />
      <path :d="line" fill="none" :stroke="color" stroke-width="2" stroke-linejoin="round" />
      <circle v-if="end" :cx="end[0]" :cy="end[1]" r="3" :fill="color" />
    </svg>
  </div>
</template>
