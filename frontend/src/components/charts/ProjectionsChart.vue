<script setup lang="ts">
// Forecasts vs actual for the month shown by the budget card: a plain bar
// chart, each bar what really came in or went out, part by part (planned,
// extra; for spending, the buffer used and what it did not cover), topped in
// a paler shade by what is still pending. The month's income and spending; or, with a card
// selected above (`focus`), that category alone - its transactions (for the
// buffer, what drew on it) listed on the left.
import type { ChartConfig } from '@/components/ui/chart';
import type { Month } from '@/lib/projections';
import type { Category, Projection, Transaction } from '@/types';
import type { BudgetFocus } from '../BudgetOverview.vue';
import { computed, ref, useTemplateRef } from 'vue';
import { useElementSize } from '@vueuse/core';
import { ChevronDown } from '@lucide/vue';
import { VisAxis, VisStackedBar, VisXYContainer } from '@unovis/vue';
import { amountTickFormat, formatCents } from '@/api';
import { budget, budgetSection } from '@/lib/budget';
import { BUFFER_COLOR, tint, withAlpha } from '@/lib/colors';
import { monthLabel } from '@/lib/projections';
import { Button } from '@/components/ui/button';
import { ChartContainer } from '@/components/ui/chart';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useFinanceData } from '@/composables/useFinanceData';
import TransactionList from '../TransactionList.vue';

const props = defineProps<{
  projections: Projection[];
  transactions: Transaction[];
  categories: Category[];
  focus?: BudgetFocus | null;
}>();
const selected = defineModel<Month>({ required: true });

const { settings } = useFinanceData();

// Each bar stacked from what happened to what is still planned, part by part
// (named in the tiles, which serve as the legend)
interface Segment {
  label: string;
  cents: number;
  color: string;
}
interface Column {
  label: string;
  color: string;
  plannedCents: number;
  actualCents: number;
  // Spending past what the forecasts and the buffer cover
  over: boolean;
  segments: Segment[];
}
const PENDING = 'Planifié';
const INCOME_COLOR = 'var(--color-emerald-600)';
// Darker than the income's green, apart from the pale pending part
const EXTRA_INCOME_COLOR = '#065f46';
const SPENDING_COLOR = 'var(--destructive)';
const OVERRUN_COLOR = '#7f1d1d';
const pending = (color: string) => withAlpha(color, 0.25);
// Income past its forecast: a darker shade of its color, apart from the pale
// pending part
const extraColor = (color: string) => (/^#[0-9a-f]{6}$/i.test(color) ? tint(color, -0.4) : color);

const columns = computed<Column[]>(() => {
  // A selected card: one category, its own forecast; past it, the buffer's
  // color for spending (what drew on it), a darker shade for income. The
  // buffer itself: what it covered, then what it did not
  if (props.focus) {
    const f = props.focus;
    return [
      {
        ...f,
        segments: [
          {
            label: f.buffer ? 'Marge utilisée' : 'Réalisé',
            cents: Math.min(f.actualCents, f.plannedCents),
            color: f.color,
          },
          {
            label: f.buffer ? 'Hors marge' : f.over ? 'Au-delà de la prévision' : 'Extra',
            cents: Math.max(0, f.actualCents - f.plannedCents),
            color: f.buffer ? OVERRUN_COLOR : f.over ? BUFFER_COLOR : extraColor(f.color),
          },
          { label: PENDING, cents: Math.max(0, f.plannedCents - f.actualCents), color: pending(f.color) },
        ],
      },
    ];
  }
  // The month: added up category by category, like the budget card's warning
  // (lib/budget.ts), so an overrun does not hide behind a bill not charged yet.
  // Pending: the forecasts not reached yet, those with no category, and for
  // spending what is left of the buffer
  const b = budget(props.projections, props.transactions, props.categories, selected.value);
  const parts = (s: ReturnType<typeof budgetSection>) => ({
    withinCents: s.compared.reduce((sum, r) => sum + Math.max(0, Math.min(r.actualCents, r.plannedCents)), 0),
    pendingCents:
      s.summary.leftCents +
      s.uncategorized.reduce((sum, r) => sum + r.plannedCents, 0) +
      s.summary.bufferCents -
      s.summary.bufferUsedCents,
  });
  const income = budgetSection(b.income);
  const i = parts(income);
  const expense = budgetSection(b.expense, settings.value.budgetBufferCents);
  const e = parts(expense);
  return [
    {
      label: 'Revenus',
      color: INCOME_COLOR,
      plannedCents: income.total.plannedCents,
      actualCents: Math.max(0, income.total.actualCents),
      over: false,
      segments: [
        { label: 'Prévus', cents: i.withinCents, color: INCOME_COLOR },
        { label: 'Extra', cents: income.summary.extraCents, color: EXTRA_INCOME_COLOR },
        { label: PENDING, cents: i.pendingCents, color: pending(INCOME_COLOR) },
      ],
    },
    {
      label: 'Dépenses',
      color: SPENDING_COLOR,
      plannedCents: expense.total.plannedCents,
      actualCents: Math.max(0, expense.total.actualCents),
      over: expense.summary.overrunCents > 0,
      segments: [
        { label: 'Prévues', cents: e.withinCents, color: SPENDING_COLOR },
        { label: 'Marge utilisée', cents: expense.summary.bufferUsedCents, color: BUFFER_COLOR },
        { label: 'Hors marge', cents: expense.summary.overrunCents, color: OVERRUN_COLOR },
        { label: PENDING, cents: e.pendingCents, color: pending('var(--brand-night)') },
      ],
    },
  ];
});
const empty = computed(() => columns.value.every((b) => b.plannedCents === 0 && b.actualCents === 0));
// One accessor per segment, as many as the longest bar has
const y = computed(() =>
  Array.from(
    { length: Math.max(...columns.value.map((c) => c.segments.length)) },
    (_, i) => (c: Column) => c.segments[i]?.cents ?? 0,
  ),
);
const color = (c: Column, i: number) => c.segments[i]?.color ?? 'transparent';
// Each tile's details (the parts of its bar), folded until asked for: its
// label, open or not
const detailsOpen = ref<Record<string, boolean>>({});
const tickValues = computed(() => columns.value.map((_, i) => i));
const tickLabel = (i: number) => columns.value[Math.round(i)]?.label ?? '';
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
      <h3 class="text-sm font-medium first-letter:uppercase">
        {{ focus?.listOnly ? focus.label : 'Prévu vs réalisé' }} · {{ monthLabel(selected) }}
      </h3>
      <p class="text-sm text-muted-foreground">
        {{ focus?.listOnly ? 'Les transactions sans prévision ce mois-ci.' : 'Revenus et dépenses du mois.' }}
      </p>
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
      <div
        v-else
        :key="focus ? (focus.listOnly ? 'list' : focus.transactions ? 'listed' : 'category') : 'month'"
        class="flex flex-col gap-3 md:flex-row md:items-center md:gap-6"
      >
        <!-- The selected card's transactions: beside the chart (a category, the
             buffer), or alone ("Non prévu", nothing planned to chart). Their
             full height on a phone: the page scrolls, not the list -->
        <div
          v-if="focus?.transactions"
          class="flex shrink-0 flex-col md:overflow-y-auto"
          :class="focus.listOnly ? 'w-full md:max-h-80' : 'md:max-h-56 md:w-80 md:self-stretch'"
        >
          <TransactionList :transactions="focus.transactions" :empty="focus.transactionsEmpty" />
        </div>
        <!-- The amounts, one small tile per bar: its color's dot, what happened in
           big, the forecast under it. None for a selected card: its own card
           above says it already -->
        <div v-if="!focus" class="grid shrink-0 grid-cols-2 gap-3 md:w-56 md:grid-cols-1">
          <Collapsible
            v-for="b in columns"
            :key="b.label"
            v-model:open="detailsOpen[b.label]"
            class="flex flex-col gap-1 rounded-2xl bg-muted/60 p-3"
          >
            <span class="flex items-center gap-2 text-sm text-muted-foreground">
              <span class="size-2.5 shrink-0 rounded-full" :style="{ background: b.color }" />
              <span class="truncate">{{ b.label }}</span>
              <CollapsibleTrigger as-child>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  class="-my-1 -mr-1.5 ml-auto size-6"
                  :aria-label="detailsOpen[b.label] ? 'Masquer le détail' : 'Voir le détail'"
                  :title="detailsOpen[b.label] ? 'Masquer le détail' : 'Voir le détail'"
                >
                  <ChevronDown class="transition-transform" :class="detailsOpen[b.label] && 'rotate-180'" />
                </Button>
              </CollapsibleTrigger>
            </span>
            <span class="truncate text-lg font-semibold tabular-nums" :class="b.over && 'text-destructive'">
              {{ formatCents(b.actualCents) }}
            </span>
            <span class="truncate text-xs text-muted-foreground tabular-nums"
              >sur {{ formatCents(b.plannedCents) }} prévus</span
            >
            <!-- The legend: each part of its bar, the ones with an amount -->
            <CollapsibleContent>
              <ul class="mt-1 flex flex-col gap-0.5 text-xs">
                <li v-for="p in b.segments.filter((p) => p.cents > 0)" :key="p.label" class="flex items-center gap-1.5">
                  <span class="size-2 shrink-0 rounded-full" :style="{ background: p.color }" />
                  <span class="truncate text-muted-foreground">{{ p.label }}</span>
                  <span class="ml-auto tabular-nums">{{ formatCents(p.cents) }}</span>
                </li>
              </ul>
            </CollapsibleContent>
          </Collapsible>
        </div>
        <!-- Phone: a selected card's chart first, its transactions under it (the
             month's tiles stay above) -->
        <div
          v-if="!focus?.listOnly"
          ref="box"
          class="min-h-56 min-w-0 md:flex-1"
          :class="focus && 'max-md:order-first'"
        >
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
