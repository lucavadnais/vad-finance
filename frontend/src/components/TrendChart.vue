<script setup lang="ts">
// The app's trend chart (month card, balance, account page): a smooth line in
// the accent color over a faded, dotted area, a dot on the last value. Edge
// to edge on the right (the parent takes it out of its side padding), with a
// y axis on the left: round amounts in their own column, from the parent's
// side padding, and light lines across. Always with a tooltip on the hovered
// (or touched) point: its label, then each line's value.
// - `compare` draws a gray line to compare with behind it (a median)
// - `target` draws a dashed level to reach or not to pass (planned spending)
// - `slots` spreads the values over more x positions than they fill (the days
//   of a month that has not ended yet); `x` places them at their dates
//   instead (values that do not come at a regular pace), which then label
//   the tooltip unless `xLabels` does, and the first and last ones are written
//   under the chart
// - `emptyMessage` is written over the chart when it has no line of its own
//   to draw (a month not started yet): the axis, the comparison and the
//   target stay
// - amounts are in cents, written by `format` (tooltip) and `formatAxis`
//   (scale): the app's own formats unless given (another currency)
// The parent's side padding is `--chart-gutter` (16px unless set): a CSS
// variable, so it can change with the screen size. The axes follow the
// "Afficher les axes" setting: without them, the lines go edge to edge.
import { computed, ref, useId, useTemplateRef } from 'vue';
import { useElementSize } from '@vueuse/core';
import { formatCents, formatCentsCompact } from '@/api';
import { useFinanceData } from '@/composables/useFinanceData';
import { monotonePath } from '@/lib/spending';

const props = withDefaults(
  defineProps<{
    values: number[];
    compare?: number[];
    target?: number;
    slots?: number;
    x?: number[];
    xLabels?: string[];
    mainLabel?: string;
    compareLabel?: string;
    targetLabel?: string;
    format?: (cents: number) => string;
    formatAxis?: (cents: number) => string;
    height?: number;
    emptyMessage?: string;
  }>(),
  {
    compare: undefined,
    target: undefined,
    slots: undefined,
    x: undefined,
    xLabels: undefined,
    mainLabel: undefined,
    compareLabel: undefined,
    targetLabel: undefined,
    format: (cents: number) => formatCents(cents),
    formatAxis: (cents: number) => formatCentsCompact(cents),
    height: 300,
    emptyMessage: undefined,
  },
);

const { settings } = useFinanceData();
// On unless turned off (settings saved before it existed have no value)
const showAxes = computed(() => settings.value.chartAxes !== false);

const box = useTemplateRef('box');
const { width } = useElementSize(box);
const INSET = 6; // room for the end dot

// Everything shares the scale: from the lowest to the highest value of any
// line and the target, widened to round amounts, the y axis' ticks (about four
// steps of 1, 2 or 5 times a power of ten)
const axis = computed(() => {
  const all = [...props.values, ...(props.compare ?? []), ...(props.target === undefined ? [] : [props.target])];
  // Nothing at all: an axis around zero
  if (all.length === 0) all.push(0);
  const lowest = Math.min(...all);
  const highest = Math.max(...all);
  const rough = (highest - lowest) / 4 || Math.abs(highest) / 2 || 100;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = power * ([1, 2, 5].find((m) => rough <= m * power * 1.5) ?? 10);
  const min = Math.floor(lowest / step) * step;
  const max = Math.max(min + step, Math.ceil(highest / step) * step);
  const ticks = Array.from({ length: Math.round((max - min) / step) + 1 }, (_, i) => min + i * step);
  return { min, max, ticks };
});
const scale = computed(() => {
  const { min, max } = axis.value;
  return (v: number) => INSET + (1 - (v - min) / (max - min)) * (props.height - 2 * INSET);
});
// The y axis' column: from the parent's side padding, as wide as its longest
// amount (about 6.5px a character at the axis' size); the lines start after it
const axisLabels = computed(() => axis.value.ticks.map((t) => ({ t, text: props.formatAxis(t) })));
const gutter = computed(() => {
  void width.value; // read again when resized: the padding may change with the screen
  return box.value ? parseFloat(getComputedStyle(box.value).getPropertyValue('--chart-gutter')) || 16 : 16;
});
const axisWidth = computed(() => Math.ceil(Math.max(...axisLabels.value.map((l) => l.text.length)) * 6.5));
const plotLeft = computed(() => (showAxes.value ? gutter.value + axisWidth.value + 8 : 0));

const xOf = computed(() => {
  const left = plotLeft.value;
  const span = width.value - INSET - left;
  if (props.x && props.x.length > 0) {
    const first = props.x[0]!;
    const range = props.x.at(-1)! - first || 1;
    return (i: number) => left + ((props.x![i]! - first) / range) * span;
  }
  const step = span / Math.max(1, (props.slots ?? props.values.length) - 1);
  return (i: number) => left + i * step;
});
const points = (values: number[]) => values.map((v, i) => [xOf.value(i), scale.value(v)] as const);
const targetY = computed(() => (props.target === undefined ? null : scale.value(props.target)));

const main = computed(() => points(props.values));
const line = computed(() => monotonePath(main.value));
const area = computed(() => {
  const last = main.value.at(-1);
  return last ? `${line.value}L${last[0]},${props.height}L${plotLeft.value},${props.height}Z` : '';
});
const end = computed(() => main.value.at(-1));
const compareLine = computed(() => (props.compare ? monotonePath(points(props.compare)) : ''));

// Several charts on a page: their gradient and pattern need their own ids
const id = useId();

// The point under the pointer (mouse, or finger on a phone): the closest x.
// A finger lifting counts as leaving: a touched point stays until another one
const count = computed(() => Math.max(props.values.length, props.compare?.length ?? 0));
const active = ref<number | null>(null);
function pick(e: PointerEvent) {
  if (count.value === 0) return;
  const at = e.clientX - (e.currentTarget as Element).getBoundingClientRect().left;
  let best = 0;
  for (let i = 1; i < count.value; i++) if (Math.abs(xOf.value(i) - at) < Math.abs(xOf.value(best) - at)) best = i;
  active.value = best;
}
function leave(e: PointerEvent) {
  if (e.pointerType === 'mouse') active.value = null;
}

const shortDate = (t: number) =>
  new Date(t).toLocaleDateString('fr-CA', { timeZone: 'UTC', day: 'numeric', month: 'short' });
const dateLabel = (t: number) =>
  new Date(t).toLocaleDateString('fr-CA', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' });
const tip = computed(() => {
  const i = active.value;
  if (i === null) return null;
  const row = (key: string, label: string | undefined, color: string, value: number | undefined, dot = true) =>
    value === undefined ? [] : [{ key, label, color, value, y: dot ? scale.value(value) : null }];
  const rows = [
    ...row('main', props.mainLabel, 'var(--brand-accent)', props.values[i]),
    ...row('compare', props.compareLabel, 'var(--brand-gray)', props.compare?.[i]),
    ...row('target', props.targetLabel, 'var(--brand-surface)', props.target, false),
  ];
  const x = xOf.value(i);
  const label = props.xLabels?.[i] ?? (props.x?.[i] === undefined ? undefined : dateLabel(props.x[i]!));
  // The box on the side with the most room, so it never leaves the chart
  // A dot on each line at that point (not on the target: it is a level)
  const dots = rows.flatMap((r) => (r.y === null ? [] : [{ key: r.key, color: r.color, y: r.y }]));
  return { x, label, rows, dots, onLeft: x > width.value / 2 };
});
</script>

<template>
  <div>
    <div ref="box" class="relative" :style="{ height: `${height}px` }">
      <!-- The y axis' amounts, in their column left of the lines -->
      <template v-if="width && showAxes">
        <span
          v-for="l in axisLabels"
          :key="l.t"
          class="pointer-events-none absolute -translate-y-1/2 text-right text-xs leading-4 text-muted-foreground tabular-nums"
          :style="{ top: `${scale(l.t)}px`, left: `${gutter}px`, width: `${axisWidth}px` }"
        >
          {{ l.text }}
        </span>
      </template>
      <!-- No line of its own: the message, centered over what is left -->
      <div
        v-if="emptyMessage && values.length <= 1"
        class="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center"
        :style="{ paddingLeft: `${plotLeft}px` }"
      >
        <p class="rounded-md border bg-card px-3 py-1.5 text-sm text-muted-foreground shadow-xs">{{ emptyMessage }}</p>
      </div>
      <!-- Hovered or touched point: its date and values, beside the line -->
      <div
        v-if="tip"
        class="pointer-events-none absolute top-0 z-10 flex flex-col gap-1 rounded-lg border bg-popover px-3 py-2 text-xs whitespace-nowrap shadow-md"
        :style="tip.onLeft ? { right: `${width - tip.x + 12}px` } : { left: `${tip.x + 12}px` }"
      >
        <span v-if="tip.label" class="font-medium">{{ tip.label }}</span>
        <span v-for="r in tip.rows" :key="r.key" class="flex items-center gap-1.5">
          <!-- The target is a dashed level, as in the chart: a dash, not a dot -->
          <svg v-if="r.y === null" width="12" height="2" class="shrink-0" aria-hidden="true">
            <line x1="0" x2="12" y1="1" y2="1" :stroke="r.color" stroke-width="2" stroke-dasharray="3 2" />
          </svg>
          <span v-else class="size-2 shrink-0 rounded-full" :style="{ background: r.color }" />
          <span v-if="r.label" class="text-muted-foreground">{{ r.label }}</span>
          <span class="ml-auto pl-2 font-medium tabular-nums">{{ format(r.value) }}</span>
        </span>
      </div>
      <!-- touch-action: a vertical swipe still scrolls the page -->
      <svg
        v-if="width"
        :width="width"
        :height="height"
        class="block touch-pan-y overflow-visible"
        aria-hidden="true"
        @pointermove="pick"
        @pointerdown="pick"
        @pointerleave="leave"
      >
        <defs>
          <linearGradient :id="`${id}-fade`" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="var(--brand-accent)" stop-opacity="0.18" />
            <stop offset="1" stop-color="var(--brand-accent)" stop-opacity="0" />
          </linearGradient>
          <pattern :id="`${id}-dots`" width="4" height="4" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.7" fill="var(--brand-accent)" fill-opacity="0.18" />
          </pattern>
        </defs>
        <!-- The y axis' light lines -->
        <line
          v-for="t in showAxes ? axis.ticks : []"
          :key="t"
          :x1="plotLeft"
          :x2="width"
          :y1="scale(t)"
          :y2="scale(t)"
          stroke="var(--border)"
        />
        <path v-if="compareLine" :d="compareLine" fill="none" stroke="var(--brand-gray)" stroke-width="2" />
        <line
          v-if="targetY !== null"
          :x1="plotLeft"
          :x2="width"
          :y1="targetY"
          :y2="targetY"
          stroke="var(--brand-surface)"
          stroke-width="1.5"
          stroke-dasharray="6 5"
        />
        <template v-if="end">
          <path :d="area" :fill="`url(#${id}-fade)`" />
          <path :d="area" :fill="`url(#${id}-dots)`" />
          <path :d="line" fill="none" stroke="var(--brand-accent)" stroke-width="2.5" stroke-linejoin="round" />
          <circle
            :cx="end[0]"
            :cy="end[1]"
            r="4"
            fill="var(--brand-accent)"
            stroke="var(--background)"
            stroke-width="2"
          />
        </template>
        <template v-if="tip">
          <line :x1="tip.x" :x2="tip.x" y1="0" :y2="height" stroke="var(--muted-foreground)" stroke-dasharray="3 3" />
          <circle
            v-for="r in tip.dots"
            :key="r.key"
            :cx="tip.x"
            :cy="r.y"
            r="4"
            :fill="r.color"
            stroke="var(--background)"
            stroke-width="2"
          />
        </template>
      </svg>
    </div>
    <!-- Dates: the first and last ones, under the lines -->
    <div
      v-if="showAxes && x && x.length > 0 && width"
      class="mt-2 flex justify-between text-xs text-muted-foreground tabular-nums"
      :style="{ paddingLeft: `${plotLeft}px`, paddingRight: `${gutter}px` }"
    >
      <span>{{ shortDate(x[0]!) }}</span>
      <span>{{ shortDate(x.at(-1)!) }}</span>
    </div>
  </div>
</template>
