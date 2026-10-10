<script setup lang="ts">
// Forecasts vs actual for the month shown by the budget card: a plain bar
// chart, each bar what really came in or went out, topped in a paler shade by
// what is still planned (spending past its forecast: the forecast and a red
// bar side by side). The month's income and spending; or, with a card
// selected above (`focus`), that category alone.
import type { ChartConfig } from '@/components/ui/chart';
import type { Month } from '@/lib/projections';
import type { Category, Projection, Transaction } from '@/types';
import type { BudgetFocus } from '../BudgetOverview.vue';
import { computed, useTemplateRef } from 'vue';
import { useElementSize } from '@vueuse/core';
import { VisAxis, VisStackedBar, VisXYContainer } from '@unovis/vue';
import { amountTickFormat, formatCents } from '@/api';
import { budget, budgetSection } from '@/lib/budget';
import { monthLabel } from '@/lib/projections';
import { ChartContainer } from '@/components/ui/chart';
import { useFinanceData } from '@/composables/useFinanceData';

const props = defineProps<{
  projections: Projection[];
  transactions: Transaction[];
  categories: Category[];
  focus?: BudgetFocus | null;
}>();
const selected = defineModel<Month>({ required: true });

const { settings } = useFinanceData();

interface Bar {
  label: string;
  color: string;
  plannedCents: number;
  actualCents: number;
  over: boolean;
}
const bars = computed<Bar[]>(() => {
  if (props.focus) return [props.focus];
  const b = budget(props.projections, props.transactions, props.categories, selected.value);
  const income = budgetSection(b.income).total;
  const expense = budgetSection(b.expense, settings.value.budgetBufferCents).total;
  const bar = (label: string, color: string, t: typeof income, canGoOver: boolean) => {
    const actualCents = Math.max(0, t.actualCents);
    return { label, color, plannedCents: t.plannedCents, actualCents, over: canGoOver && actualCents > t.plannedCents };
  };
  return [
    bar('Revenus', 'var(--color-emerald-600)', income, false),
    bar('Dépenses', 'var(--brand-night)', expense, true),
  ];
});
const empty = computed(() => bars.value.every((b) => b.plannedCents === 0 && b.actualCents === 0));

// Each bar in two stacked parts: what happened, then what is still planned.
// Past its forecast, nothing is left to stack: the forecast (pale) and what
// happened (red) then stand side by side instead.
interface Column {
  label: string;
  color: string;
  doneCents: number;
  leftCents: number;
  over: boolean;
}
const columns = computed<Column[]>(() =>
  bars.value.flatMap((b) => {
    const prefix = props.focus ? '' : `${b.label} · `;
    return b.over
      ? [
          { label: `${prefix}prévu`, color: b.color, doneCents: 0, leftCents: b.plannedCents, over: false },
          { label: `${prefix}réalisé`, color: b.color, doneCents: b.actualCents, leftCents: 0, over: true },
        ]
      : [
          {
            label: b.label,
            color: b.color,
            doneCents: b.actualCents,
            leftCents: Math.max(0, b.plannedCents - b.actualCents),
            over: false,
          },
        ];
  }),
);
const y = [(c: Column) => c.doneCents, (c: Column) => c.leftCents];
const color = (c: Column, i: number) =>
  i === 0 ? (c.over ? 'var(--destructive)' : c.color) : `color-mix(in srgb, ${c.color} 25%, transparent)`;
const tickValues = computed(() => columns.value.map((_, i) => i));
const tickLabel = (i: number) => {
  const label = columns.value[Math.round(i)]?.label ?? '';
  return label.charAt(0).toUpperCase() + label.slice(1);
};
const config: ChartConfig = {};

// Unovis leaves a gap between bars whatever their padding: each column gets
// its share of the plot's width instead (the box minus the fixed margins, the
// amounts' axis on the left), so they touch
const MARGIN = { left: 56, right: 8, top: 8, bottom: 28 };
const box = useTemplateRef('box');
const { width: boxWidth } = useElementSize(box);
const barWidth = computed(() =>
  Math.max(1, Math.floor((boxWidth.value - MARGIN.left - MARGIN.right) / Math.max(1, columns.value.length))),
);
</script>

<template>
  <section class="flex flex-col gap-3">
    <div>
      <h3 class="text-sm font-medium first-letter:uppercase">Prévu vs réalisé · {{ monthLabel(selected) }}</h3>
      <p class="text-sm text-muted-foreground">Revenus et dépenses du mois.</p>
    </div>
    <!-- Switching between the month and a selected card: the old chart fades
         out and the new one in, instead of Unovis morphing one into the other
         while the layout changes (the tiles come and go). From one card to
         another, the same chart stays and Unovis moves its bars -->
    <Transition
      mode="out-in"
      enter-active-class="transition-opacity duration-150"
      leave-active-class="transition-opacity duration-150"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <p v-if="empty" class="py-12 text-center text-sm text-muted-foreground">
        Rien de prévu ni de réalisé ce mois-ci.
      </p>
      <!-- Phone: the tiles above the chart. Computer: stacked on its left, so
         neither stretches over the card's whole width -->
      <div v-else :key="focus ? 'category' : 'month'" class="flex flex-col gap-3 md:flex-row md:items-center md:gap-6">
        <!-- The amounts, one small tile per bar: its color's dot, what happened in
           big, the forecast under it. None for a selected card: its own card
           above says it already -->
        <div v-if="!focus" class="grid shrink-0 grid-cols-2 gap-3 md:w-56 md:grid-cols-1">
          <div v-for="b in bars" :key="b.label" class="flex flex-col gap-1 rounded-2xl bg-muted/60 p-3">
            <span class="flex items-center gap-2 text-sm text-muted-foreground">
              <span
                class="size-2.5 shrink-0 rounded-full"
                :style="{ background: b.over ? 'var(--destructive)' : b.color }"
              />
              <span class="truncate">{{ b.label }}</span>
            </span>
            <span class="truncate text-lg font-semibold tabular-nums" :class="b.over && 'text-destructive'">
              {{ formatCents(b.actualCents) }}
            </span>
            <span class="truncate text-xs text-muted-foreground tabular-nums"
              >sur {{ formatCents(b.plannedCents) }} prévus</span
            >
          </div>
        </div>
        <div ref="box" class="min-h-56 min-w-0 md:flex-1">
          <!-- Drawn once its width is known, so its bars do not grow from nothing -->
          <ChartContainer
            v-if="boxWidth > 0"
            :config="config"
            class="aspect-auto h-auto [&_[data-vis-xy-container]]:h-56"
          >
            <VisXYContainer :data="columns" :margin="MARGIN" :auto-margin="false">
              <!-- Columns sharing the whole width, side by side with no gap -->
              <VisStackedBar
                :x="(_: Column, i: number) => i"
                :y="y"
                :color="color"
                :bar-width="barWidth"
                :rounded-corners="6"
              />
              <VisAxis
                type="x"
                :tick-format="tickLabel"
                :tick-values="tickValues"
                :grid-line="false"
                :tick-line="false"
              />
              <VisAxis
                type="y"
                :tick-format="amountTickFormat"
                :num-ticks="4"
                :grid-line="true"
                :domain-line="false"
                :tick-line="false"
              />
            </VisXYContainer>
          </ChartContainer>
        </div>
      </div>
    </Transition>
  </section>
</template>
