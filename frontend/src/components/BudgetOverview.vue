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
import type { Month } from '@/lib/projections';
import { computed, ref, useTemplateRef, watch, watchEffect } from 'vue';
import { useElementSize, useScroll } from '@vueuse/core';
import { ListChecks, Plus, TriangleAlert } from '@lucide/vue';
import { formatCents, formatDate } from '@/api';
import { budget, budgetSection, estimatedMonth } from '@/lib/budget';
import { NO_COLOR } from '@/lib/colors';
import { currentMonth } from '@/lib/projections';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CategoryDot from './CategoryDot.vue';
import { useAmountsHidden } from '@/composables/useAmountsHidden';
import { useFinanceData } from '@/composables/useFinanceData';
import { useSettings } from '@/composables/useSettings';

const props = defineProps<{
  month: Month;
  projections: Projection[];
  transactions: Transaction[];
  categories: Category[];
}>();
const emit = defineEmits<{ add: []; manage: [] }>();

export interface BudgetFocus {
  label: string;
  color: string;
  plannedCents: number;
  actualCents: number;
  // Spending past its forecast
  over: boolean;
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

// Light text on a dark color, dark text on a light one
function isDark(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b! < 0.6;
}

type CategoryCard = {
  key: string;
  label: string;
  color: string;
  plannedCents: number;
  actualCents: number;
};

// The buffer covers every overrun of the month: they are shown, not in red
const covered = computed(() => {
  const s = section.value.summary;
  return kind.value === 'expense' && s.bufferCents > 0 && s.extraCents > 0 && s.overrunCents === 0;
});
// Categories with a forecast, biggest first (the order of lib/budget.ts); the
// forecasts with no category share one card; then the buffer
const cards = computed<CategoryCard[]>(() => {
  const s = section.value;
  const list: CategoryCard[] = s.compared.map((r) => ({
    key: r.key,
    label: r.label,
    color: categoryColors.value.get(r.key) ?? NO_COLOR,
    plannedCents: r.plannedCents,
    actualCents: r.actualCents,
  }));
  if (s.uncategorized.length > 0)
    list.push({
      key: 'none',
      label: 'Sans catégorie',
      color: NO_COLOR,
      plannedCents: s.uncategorized.reduce((sum, r) => sum + r.plannedCents, 0),
      actualCents: 0,
    });
  if (s.summary.bufferCents > 0)
    list.push({
      key: 'buffer',
      label: 'Marge imprévus',
      color: NO_COLOR,
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
const unplannedOpen = ref(false);
const unplannedTransactions = computed(() => {
  const keys = new Set(section.value.unplanned.map((r) => r.key));
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
});

// The selected card's amounts, for the chart; unselected once it is gone
// (another month, the other side)
watchEffect(() => {
  const c = cards.value.find((c) => c.key === selected.value);
  if (selected.value && !c) selected.value = null;
  focus.value = c
    ? {
        label: c.label,
        color: c.color,
        plannedCents: c.plannedCents,
        actualCents: c.actualCents,
        over: kind.value === 'expense' && c.actualCents > c.plannedCents,
      }
    : null;
});
const select = (c: CategoryCard) => (selected.value = selected.value === c.key ? null : c.key);

// Dots under the strip, one per screenful of cards
const strip = useTemplateRef('strip');
const { x: scrollX } = useScroll(strip);
const { width: stripWidth } = useElementSize(strip);
const pages = computed(() => {
  void cards.value.length;
  const el = strip.value;
  return el && stripWidth.value > 0 ? Math.ceil(el.scrollWidth / stripWidth.value - 0.05) : 1;
});
const page = computed(() => {
  const el = strip.value;
  if (!el || pages.value < 2) return 0;
  const max = el.scrollWidth - el.clientWidth;
  return Math.round((scrollX.value / max) * (pages.value - 1));
});
watch(kind, () => strip.value?.scrollTo({ left: 0 }));
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

    <!-- The cards, scrolled sideways, edge to edge on a phone. Room above and
         below (cancelled by the margins) for the selected card's ring: the
         scrolling strip clips what goes past its edges -->
    <div
      ref="strip"
      class="-mx-4 -my-1 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 py-1.5 [scrollbar-width:none] md:-mx-6 md:scroll-px-6 md:px-6 [&::-webkit-scrollbar]:hidden"
    >
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
      <button
        v-for="c in cards"
        :key="c.key"
        type="button"
        class="flex h-44 w-40 shrink-0 snap-start flex-col rounded-3xl p-4 text-left shadow-sm transition active:scale-[0.98]"
        :style="{ background: c.color }"
        :class="[
          isDark(c.color) ? 'text-white' : 'text-neutral-900',
          selected === c.key && 'ring-2 ring-foreground ring-offset-2 ring-offset-background',
          selected && selected !== c.key && 'opacity-50',
        ]"
        :aria-pressed="selected === c.key"
        @click="select(c)"
      >
        <!-- The name, its share of the total beside it -->
        <span class="flex items-baseline gap-2">
          <span class="truncate text-base font-medium">{{ c.label }}</span>
          <span class="ml-auto shrink-0 text-xs tabular-nums opacity-75">{{ share(c) }} %</span>
        </span>
        <!-- What already went out (or came in), the forecast under it -->
        <span class="truncate text-xl font-semibold tabular-nums">
          {{ split(c.actualCents).main }}<span class="text-sm font-medium">{{ split(c.actualCents).rest }}</span>
        </span>
        <span class="truncate text-xs tabular-nums opacity-75">sur {{ formatCents(c.plannedCents) }} prévus</span>
        <!-- What really happened against the forecast -->
        <span
          class="mt-auto h-1 w-full shrink-0 overflow-hidden rounded-full"
          :class="isDark(c.color) ? 'bg-white/25' : 'bg-black/10'"
          :title="`${formatCents(c.actualCents)} réalisés`"
        >
          <span
            class="block h-full rounded-full"
            :class="isDark(c.color) ? 'bg-white' : 'bg-neutral-900'"
            :style="{ width: `${progress(c)}%` }"
          />
        </span>
      </button>
      <!-- With no forecast: what went out (or came in) anyway, its list on a tap -->
      <button
        v-if="section.unplanned.length > 0"
        type="button"
        class="flex h-44 w-40 shrink-0 snap-start flex-col rounded-3xl border-2 border-dashed border-muted-foreground/40 bg-card p-4 text-left shadow-sm transition-transform active:scale-[0.98]"
        title="Voir les transactions non prévues"
        @click="unplannedOpen = true"
      >
        <span class="truncate text-base font-medium">Non prévu</span>
        <span class="truncate text-xl font-semibold tabular-nums">
          {{ split(section.unplannedCents).main
          }}<span class="text-sm font-medium">{{ split(section.unplannedCents).rest }}</span>
        </span>
        <span class="mt-auto self-start truncate rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
          {{ covered ? 'Couvert par la marge' : `${unplannedTransactions.length} transaction(s)` }}
        </span>
      </button>
      <p v-if="cards.length === 0" class="flex h-40 shrink-0 items-center px-2 text-sm text-muted-foreground">
        Aucune prévision ce mois-ci.
      </p>
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

    <Dialog v-model:open="unplannedOpen">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{{ kind === 'expense' ? 'Dépenses' : 'Revenus' }} non prévus</DialogTitle>
          <DialogDescription>
            Ce mois-ci, dans des catégories sans prévision ·
            <span class="tabular-nums">{{ formatCents(section.unplannedCents) }}</span>
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <ul class="flex flex-col divide-y">
            <li v-for="t in unplannedTransactions" :key="t._id" class="flex items-center gap-3 py-2.5 text-sm">
              <span class="flex min-w-0 flex-col">
                <span class="truncate font-medium">{{ t.description }}</span>
                <span class="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CategoryDot :color="t.category ? categoryColors.get(t.category._id) : undefined" />
                  {{ t.category?.name ?? 'Sans catégorie' }} · {{ formatDate(t.date) }}
                </span>
              </span>
              <span class="ml-auto shrink-0 tabular-nums">{{ formatCents(Math.abs(t.amountCents)) }}</span>
            </li>
          </ul>
        </DialogBody>
      </DialogContent>
    </Dialog>
  </div>
</template>
