<script setup lang="ts">
// A goal's rings, one inside the other: a full ring for `value` (0 to 100),
// and around it two arcs, `left` and `right`, each rising from the bottom
// towards the top, an opening between them at the bottom and a small one at
// the top. The default slot fills the middle. They fill from empty when they
// appear, then follow their values.
import { computed, onMounted, ref } from 'vue';

const props = withDefaults(
  defineProps<{
    value: number;
    left: number;
    right: number;
    size?: number;
    // The inner ring's color, as a stroke class
    valueClass?: string;
  }>(),
  { size: 220, valueClass: 'stroke-primary' },
);

// The outer arcs, thin, then a gap, then the inner ring, thicker
const OUTER = 8;
const INNER = 14;
const GAP = 6;
// The openings between the arcs, in degrees: at the bottom and at the top
const BOTTOM = 60;
const TOP = 8;

const c = computed(() => props.size / 2);
const outerR = computed(() => (props.size - OUTER) / 2);
const innerR = computed(() => outerR.value - OUTER / 2 - GAP - INNER / 2);

// A point at `deg` degrees clockwise from the top, on the outer arcs
function point(deg: number) {
  const a = (deg * Math.PI) / 180;
  return `${c.value + outerR.value * Math.sin(a)} ${c.value - outerR.value * Math.cos(a)}`;
}
// An arc from the bottom opening up to the top one: clockwise on the left,
// the other way on the right
function arc(side: -1 | 1) {
  const r = outerR.value;
  const from = 180 - (side * BOTTOM) / 2;
  const to = side === 1 ? TOP / 2 : 360 - TOP / 2;
  return `M ${point(from)} A ${r} ${r} 0 0 ${side === 1 ? 0 : 1} ${point(to)}`;
}

// Empty on the first frame, so the fills' transitions play. Every stroke is
// 100 long (pathLength): its offset is what is left to fill
const shown = ref(false);
onMounted(() => requestAnimationFrame(() => (shown.value = true)));
const offset = (v: number) => (shown.value ? 100 - Math.min(100, Math.max(0, v)) : 100);
const arcs = computed(() => [
  { d: arc(-1), offset: offset(props.left), cls: 'stroke-muted-foreground' },
  { d: arc(1), offset: offset(props.right), cls: 'stroke-[var(--brand-gray)]' },
]);
const valueOffset = computed(() => offset(props.value));
</script>

<template>
  <div
    class="relative inline-grid shrink-0 place-items-center"
    :style="{ width: `${size}px`, height: `${size}px` }"
    role="progressbar"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-valuenow="Math.round(Math.min(100, Math.max(0, value)))"
  >
    <svg :width="size" :height="size" aria-hidden="true">
      <!-- The outer arcs: each its track, then its fill -->
      <template v-for="a in arcs" :key="a.cls">
        <path :d="a.d" fill="none" :stroke-width="OUTER" stroke-linecap="round" class="stroke-muted" />
        <path
          :d="a.d"
          fill="none"
          :stroke-width="OUTER"
          stroke-linecap="round"
          pathLength="100"
          stroke-dasharray="100 100"
          :stroke-dashoffset="a.offset"
          :opacity="a.offset === 100 ? 0 : 1"
          :class="a.cls"
          class="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </template>

      <!-- The inner ring, from the top -->
      <g :transform="`rotate(-90 ${c} ${c})`">
        <circle :cx="c" :cy="c" :r="innerR" fill="none" :stroke-width="INNER" class="stroke-muted" />
        <circle
          :cx="c"
          :cy="c"
          :r="innerR"
          fill="none"
          :stroke-width="INNER"
          stroke-linecap="round"
          pathLength="100"
          stroke-dasharray="100 100"
          :stroke-dashoffset="valueOffset"
          :opacity="valueOffset === 100 ? 0 : 1"
          :class="valueClass"
          class="transition-[stroke-dashoffset,stroke] duration-700 ease-out"
        />
      </g>
    </svg>
    <span class="absolute flex flex-col items-center text-center font-semibold tabular-nums">
      <slot />
    </span>
  </div>
</template>
