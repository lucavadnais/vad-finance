<script setup lang="ts">
// Top of the budget card: the month's planned spending (or income) in big,
// a pill with what is left of it, the estimated net beside it; then a strip of
// cards, one per category with a forecast (its planned amount, its share of
// the total, what already went out against it, a thin bar of it), then the
// spending or income with no forecast (opening its transactions), scrolled
// sideways. The "+"
// card adds a forecast (`add`), the round button under it lists them all
// (`manage`). Tapping a card selects it (v-model:selected, its key; again to
// unselect), and hands its amounts over to the chart below (v-model:focus).
import type { Category, Projection, Transaction } from '@/types';
import type { BudgetRow } from '@/lib/budget';
import type { Month } from '@/lib/projections';
import { computed, onBeforeUnmount, ref, useTemplateRef, watch, watchEffect } from 'vue';
import { useElementSize, useScroll } from '@vueuse/core';
import { CalendarClock, ListChecks, Pencil, Plus, ShieldCheck, TriangleAlert } from '@lucide/vue';
import { formatCents } from '@/api';
import { budget, budgetSection, estimatedMonth } from '@/lib/budget';
import { BUFFER_COLOR, NO_COLOR, isDark } from '@/lib/colors';
import { currentMonth } from '@/lib/projections';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAmountsHidden } from '@/composables/useAmountsHidden';
import { useFinanceData } from '@/composables/useFinanceData';
import { useSettings } from '@/composables/useSettings';
import EmptyState from './EmptyState.vue';

const props = defineProps<{
  month: Month;
  projections: Projection[];
  transactions: Transaction[];
  categories: Category[];
}>();
const emit = defineEmits<{ add: []; manage: []; edit: [projection: Projection] }>();

export interface BudgetFocus {
  label: string;
  color: string;
  plannedCents: number;
  actualCents: number;
  // Spending past its forecast
  over: boolean;
  // Its transactions, listed beside the chart: a category's this month; for
  // the buffer, what drew on it (spending with no forecast, or in a category
  // past its forecast); for "Non prévu", the spending (or income) with no
  // forecast. `transactionsEmpty`: said when there are none
  transactions?: Transaction[];
  transactionsEmpty?: string;
  // "Non prévu": nothing planned to compare with, the list alone
  listOnly?: boolean;
}
const selected = defineModel<string | null>('selected', { default: null });
const focus = defineModel<BudgetFocus | null>('focus', { default: null });

const { categoryColors, settings } = useFinanceData();
const { amountsHidden } = useAmountsHidden();
const { openSettings } = useSettings();

const kind = ref<'expense' | 'income'>('expense');
const data = computed(() => budget(props.projections, props.transactions, props.categories, props.month));
// Spending: the monthly buffer is planned too (see lib/budget.ts)
const bufferCents = computed(() => (kind.value === 'expense' ? settings.value.budgetBufferCents : 0));
const section = computed(() => budgetSection(data.value[kind.value], bufferCents.value));
const plannedCents = computed(() => section.value.total.plannedCents);

const isPast = computed(() => {
  const now = currentMonth();
  return Date.UTC(props.month.year, props.month.month) < Date.UTC(now.year, now.month);
});
const netCents = computed(() => estimatedMonth(data.value, settings.value.budgetBufferCents, isPast.value).netCents);

// Spending past the forecasts, or income late: said in a sentence, with what
// to do about it, instead of the pill
const alert = computed(() => {
  const s = section.value.summary;
  if (kind.value === 'expense' && s.overrunCents > 0) return { kind: 'overrun' as const, cents: s.overrunCents };
  if (kind.value === 'income' && s.lateCents > 0) return { kind: 'late' as const, cents: s.lateCents };
  return null;
});
// Otherwise, in a sentence: what is left to spend or receive, the planned total
// minus the actual one, as the chart below shows them (not the categories'
// leftovers added up: the buffer, overruns and uncategorized forecasts count)
const leftCents = computed(() => {
  const { plannedCents: planned, actualCents } = section.value.total;
  return planned > 0 ? Math.max(0, planned - actualCents) : null;
});

// A big amount with its cents smaller, as "1 475" and ",00 $"
function split(cents: number) {
  const text = formatCents(cents);
  const i = text.lastIndexOf(',');
  return i < 0 ? { main: text, rest: '' } : { main: text.slice(0, i), rest: text.slice(i) };
}

// The forecasts behind a card: its pencil edits them
const forecastsOf = (rows: BudgetRow[]) => rows.flatMap((r) => r.forecasts.map((f) => f.projection));

type CategoryCard = {
  key: string;
  label: string;
  color: string;
  plannedCents: number;
  actualCents: number;
  // The monthly buffer: set apart from the categories (accent, hatched, a shield)
  buffer?: boolean;
  projections: Projection[];
};
// The buffer's card: its color crossed by faint stripes, a reserve put aside
const BUFFER_BACKGROUND = `repeating-linear-gradient(135deg, rgb(255 255 255 / 0.07) 0 6px, transparent 6px 14px), ${BUFFER_COLOR}`;

// The buffer covers every overrun of the month: they are shown, not in red
const covered = computed(() => {
  const s = section.value.summary;
  return kind.value === 'expense' && s.bufferCents > 0 && s.extraCents > 0 && s.overrunCents === 0;
});
// "Non prévu", unless the buffer covers it: its transactions are then in the
// buffer's list
const showUnplanned = computed(() => section.value.unplanned.length > 0 && !covered.value);
// Categories with a forecast, biggest first (the order of lib/budget.ts); the
// forecasts with no category share one card; then the buffer
const cards = computed<CategoryCard[]>(() => {
  const s = section.value;
  const list: CategoryCard[] = s.compared.map((r) => ({
    key: r.key,
    label: r.label,
    projections: forecastsOf([r]),
    color: categoryColors.value.get(r.key) ?? NO_COLOR,
    plannedCents: r.plannedCents,
    actualCents: r.actualCents,
  }));
  if (s.uncategorized.length > 0)
    list.push({
      key: 'none',
      label: 'Sans catégorie',
      projections: forecastsOf(s.uncategorized),
      color: NO_COLOR,
      plannedCents: s.uncategorized.reduce((sum, r) => sum + r.plannedCents, 0),
      actualCents: 0,
    });
  if (s.summary.bufferCents > 0)
    list.push({
      key: 'buffer',
      label: 'Marge imprévus',
      color: BUFFER_COLOR,
      buffer: true,
      projections: [],
      plannedCents: s.summary.bufferCents,
      actualCents: s.summary.bufferUsedCents,
    });
  return list;
});
const share = (c: CategoryCard) =>
  plannedCents.value > 0 ? Math.round((c.plannedCents / plannedCents.value) * 100) : 0;
const progress = (c: CategoryCard) => (c.plannedCents > 0 ? Math.min(100, (c.actualCents / c.plannedCents) * 100) : 0);

// Spending or income with no forecast this month: its transactions, latest
// first, listed in a dialog
// The month's transactions in the budget rows `keys`, latest first
function monthTransactions(keys: Set<string>) {
  const known = new Set(props.categories.map((c) => c._id));
  return props.transactions
    .filter((t) => {
      const d = new Date(t.date);
      if (t.transferAccount || d.getUTCFullYear() !== props.month.year || d.getUTCMonth() !== props.month.month)
        return false;
      // Keyed as in lib/budget.ts: the category, or "none" and the sign
      const id = t.category?._id;
      return keys.has(id && known.has(id) ? id : `none:${t.amountCents < 0 ? 'expense' : 'income'}`);
    })
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
}
const unplannedTransactions = computed(() => monthTransactions(new Set(section.value.unplanned.map((r) => r.key))));
// What drew on the buffer: the spending with no forecast, and the categories
// past theirs
const bufferTransactions = computed(() =>
  monthTransactions(
    new Set([
      ...section.value.unplanned.map((r) => r.key),
      ...section.value.compared.filter((r) => r.actualCents > r.plannedCents).map((r) => r.key),
    ]),
  ),
);

// "Non prévu" selected, like a card (its key)
const UNPLANNED = 'unplanned';

// The selected card's amounts, for the chart; unselected once it is gone
// (another month, the other side)
watchEffect(() => {
  if (selected.value === UNPLANNED && showUnplanned.value) {
    focus.value = {
      label: 'Non prévu',
      color: NO_COLOR,
      plannedCents: 0,
      actualCents: section.value.unplannedCents,
      over: false,
      transactions: unplannedTransactions.value,
      listOnly: true,
    };
    return;
  }
  const c = cards.value.find((c) => c.key === selected.value);
  if (selected.value && !c) selected.value = null;
  focus.value = c
    ? {
        label: c.label,
        color: c.color,
        plannedCents: c.plannedCents,
        actualCents: c.actualCents,
        over: kind.value === 'expense' && c.actualCents > c.plannedCents,
        // Not "Sans catégorie": its forecasts have no transactions of their own
        transactions: c.buffer
          ? bufferTransactions.value
          : c.key === 'none'
            ? undefined
            : monthTransactions(new Set([c.key])),
        transactionsEmpty: c.buffer ? "Rien n'a encore puisé dans la marge" : 'Aucune transaction ce mois-ci',
      }
    : null;
});
const select = (key: string) => (selected.value = selected.value === key ? null : key);

// Dots under the strip, one per screenful of cards
const strip = useTemplateRef('strip');
const { x: scrollX } = useScroll(strip);
const { width: stripWidth } = useElementSize(strip);
const pages = computed(() => {
  void cards.value.length;
  const el = strip.value;
  // Both with the strip's padding (stripWidth, the content box, has none): a
  // strip that fits is one page
  return el && stripWidth.value > 0 ? Math.ceil(el.scrollWidth / el.clientWidth - 0.05) : 1;
});
const page = computed(() => {
  const el = strip.value;
  if (!el || pages.value < 2) return 0;
  const max = el.scrollWidth - el.clientWidth;
  return Math.round((scrollX.value / max) * (pages.value - 1));
});
watch(kind, () => {
  stopMotion();
  stretch.value = 0;
  strip.value?.scrollTo({ left: 0 });
});

// A mouse drags the strip sideways (its scrollbar is hidden; touch scrolls
// it natively). Past a few pixels it is a drag: the click that ends it does
// not select a card. Let go while moving, it glides on, slowing down. Past an
// end, it stretches (pulled, or carried by its glide) and springs back.
const drag = ref<{ x: number; left: number; moved: boolean } | null>(null);
// The last positions, for the speed at release: [time, position]
let samples: [number, number][] = [];
// Frame of the glide or the spring running, if any
let frame = 0;
const stopMotion = () => cancelAnimationFrame(frame);
onBeforeUnmount(stopMotion);

// Past an end: the strip shifted by `stretch` px (> 0 past the start), the
// further pulled the stiffer
const stretch = ref(0);
const stripStyle = computed(() => (stretch.value ? { transform: `translateX(${stretch.value}px)` } : undefined));
const rubber = (over: number, size: number) => (1 - 1 / ((over * 0.55) / size + 1)) * size;

function onPointerDown(e: PointerEvent) {
  const el = strip.value;
  if (!el || e.pointerType !== 'mouse' || e.button !== 0) return;
  stopMotion();
  drag.value = { x: e.clientX, left: el.scrollLeft - stretch.value, moved: false };
  samples = [[e.timeStamp, el.scrollLeft]];
}
function onPointerMove(e: PointerEvent) {
  const el = strip.value;
  const d = drag.value;
  if (!el || !d) return;
  // Released outside before it became a drag
  if (!(e.buttons & 1)) return void (drag.value = null);
  const dx = e.clientX - d.x;
  if (!d.moved && Math.abs(dx) < 5) return;
  if (!d.moved) el.setPointerCapture(e.pointerId);
  d.moved = true;
  const max = el.scrollWidth - el.clientWidth;
  const target = d.left - dx;
  el.scrollLeft = Math.min(Math.max(target, 0), max);
  stretch.value =
    target < 0 ? rubber(-target, el.clientWidth) : target > max ? -rubber(target - max, el.clientWidth) : 0;
  samples.push([e.timeStamp, target]);
  samples = samples.filter(([t]) => e.timeStamp - t < 100);
}
function onPointerUp(e: PointerEvent) {
  const moved = drag.value?.moved;
  drag.value = null;
  // The click comes right after: swallowed by onClickCapture, then forgotten
  if (moved) dragged = true;
  setTimeout(() => (dragged = false));
  if (!moved) return;
  if (stretch.value) springBack(0);
  else startGlide(e.timeStamp);
}
let dragged = false;
function onClickCapture(e: MouseEvent) {
  if (!dragged) return;
  e.stopPropagation();
  e.preventDefault();
}

// The speed over the last 100 ms (px/ms), then lost little by little; an end
// reached still moving: the rest of it stretches the strip
const FRICTION = 0.8; // kept per 16 ms frame
function startGlide(now: number) {
  const el = strip.value;
  // Held still before letting go: no glide
  const recent = samples.filter(([t]) => now - t < 100);
  const first = recent[0];
  const last = recent[recent.length - 1];
  if (!el || !first || !last || last[0] <= first[0]) return;
  let speed = (last[1] - first[1]) / (last[0] - first[0]);
  let previous = performance.now();
  const step = (time: number) => {
    const dt = Math.min(time - previous, 50);
    previous = time;
    const max = el.scrollWidth - el.clientWidth;
    const next = el.scrollLeft + speed * dt;
    if (next < 0 || next > max) {
      el.scrollLeft = next < 0 ? 0 : max;
      return springBack(-speed);
    }
    el.scrollLeft = next;
    speed *= FRICTION ** (dt / 16);
    if (Math.abs(speed) > 0.02) frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
}

// A damped spring pulling the stretch back to 0, from `velocity` (px/ms):
// slightly under-damped, so a fast glide overshoots a little and settles
const STIFFNESS = 0.0005;
const DAMPING = 0.035;
function springBack(velocity: number) {
  let v = Math.max(-3, Math.min(3, velocity));
  let x = stretch.value;
  let previous = performance.now();
  const step = (time: number) => {
    // Small steps, for a steady spring whatever the frame rate
    for (let left = Math.min(time - previous, 50); left > 0; left -= 4) {
      const dt = Math.min(left, 4);
      v += (-STIFFNESS * x - DAMPING * v) * dt;
      x += v * dt;
    }
    previous = time;
    if (Math.abs(x) < 0.5 && Math.abs(v) < 0.01) return void (stretch.value = 0);
    stretch.value = x;
    frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- The planned total in big, the side switched top right -->
    <div class="flex items-start gap-3">
      <div class="mr-auto flex min-w-0 flex-col gap-1">
        <h3 class="text-base">
          <span class="font-semibold">{{ kind === 'expense' ? 'Dépenses' : 'Revenus' }}</span>
          {{ kind === 'expense' ? 'prévues' : 'prévus' }}
        </h3>
        <p class="text-[clamp(2.25rem,12vw,3.25rem)] leading-none font-semibold tracking-tight tabular-nums">
          {{ split(plannedCents).main }}<span class="text-[0.55em] font-medium">{{ split(plannedCents).rest }}</span>
        </p>
      </div>
      <Tabs v-model="kind">
        <TabsList>
          <TabsTrigger value="expense">Dépenses</TabsTrigger>
          <TabsTrigger value="income">Revenus</TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
    <!-- What is left of it, and how the month will end -->
    <div class="flex flex-col gap-1 text-sm text-muted-foreground">
      <p v-if="leftCents !== null && !alert">
        <template v-if="leftCents > 0">
          Il vous reste
          <strong class="font-semibold text-amber-600 tabular-nums dark:text-amber-300">{{
            formatCents(leftCents)
          }}</strong>
          {{ kind === 'expense' ? 'à dépenser pour respecter votre budget.' : 'de revenus prévus à recevoir.' }}
        </template>
        <template v-else>
          {{
            kind === 'expense' ? 'Vous avez atteint votre budget de dépenses.' : 'Tous vos revenus prévus sont arrivés.'
          }}
        </template>
      </p>
      <!-- The estimated net, in a sentence: what the month will end with (or
           did, once over) -->
      <p>
        {{ isPast ? 'Vous avez terminé le mois avec' : 'Avec les prévisions actuelles, vous terminerez le mois avec' }}
        <span
          class="font-medium tabular-nums"
          :class="netCents < 0 ? 'text-destructive' : netCents > 0 ? 'text-emerald-600' : 'text-foreground'"
          >{{ netCents > 0 && !amountsHidden ? '+' : '' }}{{ formatCents(netCents) }}</span
        >.
      </p>
    </div>

    <!-- Over the forecasts, or income late: a word of warning and what to do -->
    <div
      v-if="alert"
      role="alert"
      class="flex gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm"
    >
      <TriangleAlert class="mt-0.5 size-4 shrink-0 text-destructive" />
      <div class="flex flex-col items-start gap-1.5">
        <p v-if="alert.kind === 'overrun'">
          Attention, vos dépenses dépassent vos prévisions de
          <strong class="text-destructive tabular-nums">{{ formatCents(alert.cents) }}</strong
          >.
          {{
            section.summary.bufferCents > 0
              ? 'Votre marge pour les imprévus est épuisée : pensez à l’augmenter.'
              : 'Pensez à prévoir une marge pour les petites dépenses imprévues.'
          }}
        </p>
        <p v-else>
          Attention, il manque
          <strong class="text-destructive tabular-nums">{{ formatCents(alert.cents) }}</strong>
          de revenus prévus à ce jour. Vérifiez qu'ils sont bien arrivés, ou ajustez vos prévisions.
        </p>
        <button
          type="button"
          class="font-medium text-primary underline underline-offset-4 hover:no-underline"
          @click="alert.kind === 'overrun' ? openSettings('budget') : emit('manage')"
        >
          {{
            alert.kind === 'late'
              ? 'Gérer les prévisions'
              : section.summary.bufferCents > 0
                ? 'Augmenter la marge'
                : 'Prévoir une marge'
          }}
        </button>
      </div>
    </div>

    <!-- The cards, scrolled sideways, edge to edge on a phone; with a mouse,
         dragged, and without snapping (a snap would undo each small step). Room above and below (cancelled by the margins) for the
         selected card's ring: the scrolling strip clips what goes past its
         edges -->
    <div
      ref="strip"
      class="-mx-4 -my-1 flex snap-x snap-mandatory scroll-px-4 pointer-fine:snap-none gap-3 overflow-x-auto px-4 py-1.5 [scrollbar-width:none] md:-mx-6 md:scroll-px-6 md:px-6 [&::-webkit-scrollbar]:hidden"
      :class="drag?.moved ? 'cursor-grabbing select-none' : 'pointer-fine:cursor-grab'"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @click.capture="onClickCapture"
      @dragstart.prevent
    >
      <!-- The content stretches past an end, not the strip: it keeps clipping -->
      <div class="flex min-w-full shrink-0 gap-3" :style="stripStyle">
        <!-- Adding a forecast, and under it, managing them all -->
        <div class="flex w-16 shrink-0 snap-start flex-col gap-2">
          <button
            type="button"
            class="flex flex-1 items-center justify-center rounded-full border-2 text-foreground transition-colors hover:bg-muted"
            aria-label="Ajouter une prévision"
            title="Ajouter une prévision"
            @click="emit('add')"
          >
            <Plus class="size-6" />
          </button>
          <button
            type="button"
            class="flex size-16 items-center justify-center rounded-full bg-secondary text-secondary-foreground transition-colors hover:bg-secondary/80"
            aria-label="Gérer les prévisions"
            title="Gérer les prévisions"
            @click="emit('manage')"
          >
            <ListChecks class="size-5" />
          </button>
        </div>
        <template v-for="c in cards" :key="c.key">
          <!-- The buffer apart from the categories -->
          <Separator v-if="c.buffer" orientation="vertical" class="self-center data-[orientation=vertical]:h-32" />
          <!-- The card selects itself; its pencil (bottom right) edits it -->
          <div
            class="relative h-44 w-40 shrink-0 snap-start rounded-3xl shadow-sm transition has-[>button:active]:scale-[0.98]"
            :style="{ background: c.buffer ? BUFFER_BACKGROUND : c.color }"
            :class="[
              isDark(c.color) ? 'text-white' : 'text-neutral-900',
              selected === c.key && 'ring-2 ring-foreground ring-offset-2 ring-offset-background',
              selected && selected !== c.key && 'opacity-50',
            ]"
          >
            <button
              type="button"
              class="flex size-full flex-col rounded-[inherit] p-4 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              :aria-pressed="selected === c.key"
              @click="select(c.key)"
            >
              <!-- The name (on two lines if need be: the card is narrow), its share
               of the total beside it - under the buffer's shield -->
              <span class="flex items-start gap-2">
                <span class="line-clamp-2 text-base leading-tight font-medium break-words" :title="c.label">
                  {{ c.label }}
                </span>
                <span class="mt-0.5 ml-auto flex shrink-0 flex-col items-end gap-1">
                  <ShieldCheck v-if="c.buffer" class="size-4" />
                  <span class="text-xs tabular-nums opacity-75">{{ share(c) }} %</span>
                </span>
              </span>
              <!-- What already went out (or came in), the forecast under it -->
              <span class="truncate text-xl font-semibold tabular-nums">
                {{ split(c.actualCents).main }}<span class="text-sm font-medium">{{ split(c.actualCents).rest }}</span>
              </span>
              <span class="truncate text-xs tabular-nums opacity-75">sur {{ formatCents(c.plannedCents) }} prévus</span>
              <!-- What really happened against the forecast -->
              <span
                class="mt-auto h-1 shrink-0 overflow-hidden rounded-full"
                :class="[
                  isDark(c.color) ? 'bg-white/25' : 'bg-black/10',
                  selected === c.key ? 'w-[calc(100%-2.25rem)]' : 'w-full',
                ]"
                :title="`${formatCents(c.actualCents)} réalisés`"
              >
                <span
                  class="block h-full rounded-full"
                  :class="isDark(c.color) ? 'bg-white' : 'bg-neutral-900'"
                  :style="{ width: `${progress(c)}%` }"
                />
              </span>
            </button>
            <!-- Once selected, editing it quickly: its one forecast, a pick among
               several, or the buffer in the settings -->
            <Button
              v-if="selected === c.key && (c.buffer || c.projections.length === 1)"
              size="icon-sm"
              variant="ghost"
              class="absolute right-2.5 bottom-2 text-inherit hover:bg-current/15 hover:text-inherit"
              :aria-label="`Modifier ${c.buffer ? 'la marge' : c.projections[0]!.name}`"
              :title="`Modifier ${c.buffer ? 'la marge' : c.projections[0]!.name}`"
              @click="c.buffer ? openSettings('budget') : emit('edit', c.projections[0]!)"
            >
              <Pencil />
            </Button>
            <DropdownMenu v-else-if="selected === c.key && c.projections.length > 1">
              <DropdownMenuTrigger as-child>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  class="absolute right-2.5 bottom-2 text-inherit hover:bg-current/15 hover:text-inherit aria-expanded:bg-current/15"
                  :aria-label="`Modifier une prévision de ${c.label}`"
                  :title="`Modifier une prévision de ${c.label}`"
                >
                  <Pencil />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Modifier</DropdownMenuLabel>
                <DropdownMenuItem v-for="p in c.projections" :key="p._id" @select="emit('edit', p)">
                  {{ p.name }}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </template>
        <!-- With no forecast: what went out (or came in) anyway, selected like a
           card: its transactions then show below, in place of the chart. Not
           when the buffer covers it -->
        <button
          v-if="showUnplanned"
          type="button"
          class="flex h-44 w-40 shrink-0 snap-start flex-col rounded-3xl border-2 border-dashed border-muted-foreground/40 bg-card p-4 text-left shadow-sm transition active:scale-[0.98]"
          :class="[
            selected === UNPLANNED && 'ring-2 ring-foreground ring-offset-2 ring-offset-background',
            selected && selected !== UNPLANNED && 'opacity-50',
          ]"
          :aria-pressed="selected === UNPLANNED"
          title="Voir les transactions non prévues"
          @click="select(UNPLANNED)"
        >
          <span class="truncate text-base font-medium">Non prévu</span>
          <span class="truncate text-xl font-semibold tabular-nums">
            {{ split(section.unplannedCents).main
            }}<span class="text-sm font-medium">{{ split(section.unplannedCents).rest }}</span>
          </span>
          <span class="mt-auto self-start truncate rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
            {{ unplannedTransactions.length }} transaction(s)
          </span>
        </button>
        <!-- Beside the "+" and the list, which stay: centered in the room left.
           Not once any card shows (the buffer is one, "Non prévu" too) -->
        <EmptyState
          v-if="cards.length === 0 && !showUnplanned"
          :icon="CalendarClock"
          title="Aucune prévision ce mois-ci"
          class="h-44 min-w-56 shrink-0 p-4 md:p-4"
        />
      </div>
    </div>
    <!-- Where the strip is -->
    <div v-if="pages > 1" class="flex justify-center gap-1.5" aria-hidden="true">
      <span
        v-for="i in pages"
        :key="i"
        class="h-1.5 rounded-full transition-all"
        :class="i - 1 === page ? 'w-6 bg-foreground' : 'w-3 bg-muted-foreground/40'"
      />
    </div>
  </div>
</template>
