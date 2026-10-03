<script setup lang="ts">
// Budget of one month, inside the forecasts card: net, income and spending
// tiles (actual vs planned); clicking income or spending lists its categories,
// each one's forecasts next to what was really spent or received. Forecasts are matched to transactions through
// their category.
import type { Category, Projection, Transaction } from '@/types';
import type { BudgetRow } from '@/lib/budget';
import type { Month } from '@/lib/projections';
import { computed, ref } from 'vue';
import { Check, ChevronDown, ChevronRight } from '@lucide/vue';
import { formatCents } from '@/api';
import { budget, sum } from '@/lib/budget';
import { currentMonth, occurrences, totals } from '@/lib/projections';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
import { useFinanceData } from '@/composables/useFinanceData';
import CategoryDot from './CategoryDot.vue';

const props = defineProps<{
  month: Month;
  projections: Projection[];
  transactions: Transaction[];
  categories: Category[];
}>();
const emit = defineEmits<{ edit: [projection: Projection] }>();

// Rows of a category are keyed by its id (see lib/budget.ts)
const { categoryColors } = useFinanceData();

// Section summary, added up category by category (a net total would let an
// overrun in one category hide behind a bill not charged yet in another):
// - leftCents: forecast not reached yet (still to spend, or to receive)
// - lateCents: part of it already due by today (shown for income: not received)
// - extraCents: above the forecasts, plus everything with no forecast
function summarize(compared: BudgetRow[], unplannedCents: number) {
  let leftCents = 0;
  let lateCents = 0;
  let extraCents = unplannedCents;
  for (const r of compared) {
    leftCents += Math.max(0, r.plannedCents - r.actualCents);
    lateCents += Math.max(0, r.dueCents - r.actualCents);
    extraCents += Math.max(0, r.actualCents - r.plannedCents);
  }
  return { leftCents, lateCents, extraCents };
}

const data = computed(() => budget(props.projections, props.transactions, props.categories, props.month));
const sections = computed(() =>
  (
    [
      { kind: 'income', title: 'Revenus', rows: data.value.income },
      { kind: 'expense', title: 'Dépenses', rows: data.value.expense },
    ] as const
  )
    .filter((s) => s.rows.length > 0)
    .map((s) => {
      // Compared rows, then the categories with no forecast (folded), then the
      // forecasts with no category (nothing to compare them with)
      const compared = s.rows.filter((r) => !r.uncategorized && r.plannedCents > 0);
      const unplanned = s.rows.filter((r) => !r.uncategorized && r.plannedCents === 0);
      const uncategorized = s.rows.filter((r) => r.uncategorized);
      const unplannedCents = sum(unplanned).actualCents;
      return {
        ...s,
        compared,
        unplanned,
        uncategorized,
        unplannedCents,
        // Every forecast counts in the planned total, like in the net
        total: sum(s.rows),
        summary: summarize(compared, unplannedCents),
      };
    }),
);
// Net over the whole month: what already came in and went out, plus the
// forecasts not reached yet (to receive, minus to spend). A finished month
// keeps its actual net: what did not happen will not anymore.
const isPast = computed(() => {
  const now = currentMonth();
  return Date.UTC(props.month.year, props.month.month) < Date.UTC(now.year, now.month);
});
const net = computed(() => {
  const actualCents = sum(data.value.income).actualCents - sum(data.value.expense).actualCents;
  const left = (kind: 'income' | 'expense') => sections.value.find((s) => s.kind === kind)?.summary.leftCents ?? 0;
  return {
    actualCents,
    estimatedCents: isPast.value ? actualCents : actualCents + left('income') - left('expense'),
    plannedCents: totals(occurrences(props.projections, props.month)).netCents,
  };
});
const netGap = computed(() => net.value.estimatedCents - net.value.plannedCents);
const netClass = (cents: number) => (cents < 0 ? 'text-destructive' : cents > 0 ? 'text-emerald-600' : '');

const unplannedOpen = ref<Record<string, boolean>>({});

// The side whose detail is shown under the tiles: click a tile to open or close
// it. The parent opens one too, when a month is picked in the chart.
const expanded = defineModel<'income' | 'expense' | null>('expanded', { default: null });
const toggle = (kind: 'income' | 'expense') => (expanded.value = expanded.value === kind ? null : kind);
const detail = computed(() => sections.value.find((s) => s.kind === expanded.value));

// Bars only turn red on a spending overrun: an income bar shows money received,
// its lateness is said in red text instead
type Section = (typeof sections.value)[number];
const isSectionBad = (s: Section) => s.kind === 'expense' && s.summary.extraCents > 0;

type Amounts = Pick<BudgetRow, 'kind' | 'plannedCents' | 'dueCents' | 'actualCents'>;

// The actual amount is on plan anywhere between what was due by today (see
// BudgetRow.dueCents) and the whole month's forecast: money can go out before
// the forecast's day. Below the due part is a shortfall (negative gap), above
// the month's forecast an overrun (positive gap).
function gap(r: Amounts) {
  if (r.actualCents < r.dueCents) return r.actualCents - r.dueCents;
  if (r.actualCents > r.plannedCents) return r.actualCents - r.plannedCents;
  return 0;
}
// Spending over the forecast, or income short of it, is the bad side
const isBad = (r: Amounts) => (r.kind === 'expense' ? gap(r) > 0 : gap(r) < 0);

// A category's status, as a badge. `rank` orders the rows: what needs
// attention first, then in progress, upcoming, and reached last.
type Tone = 'bad' | 'good' | 'muted' | 'done';
function status(r: BudgetRow): { rank: number; tone: Tone; label: string } {
  const g = gap(r);
  const amount = formatCents(Math.abs(g));
  if (g > 0)
    return r.kind === 'expense'
      ? { rank: 0, tone: 'bad', label: `Dépassé de ${amount}` }
      : { rank: 4, tone: 'good', label: `${amount} de plus` };
  if (g < 0)
    return r.kind === 'income'
      ? { rank: 0, tone: 'bad', label: `En retard · ${amount}` }
      : { rank: 1, tone: 'muted', label: `${amount} pas encore passés` };
  if (r.actualCents >= r.plannedCents) return { rank: 4, tone: 'done', label: 'Atteint' };
  if (r.actualCents === 0 && r.dueCents === 0) {
    const first = Math.min(...r.forecasts.flatMap((f) => f.days));
    return { rank: 3, tone: 'muted', label: `À venir le ${first}` };
  }
  return { rank: 2, tone: 'muted', label: `Reste ${formatCents(r.plannedCents - r.actualCents)}` };
}
const TONES: Record<Tone, string> = {
  bad: 'border-destructive/40 text-destructive',
  good: 'border-emerald-600/40 text-emerald-600',
  muted: 'text-muted-foreground',
  done: '',
};

const detailRows = computed(() =>
  (detail.value?.compared ?? [])
    .map((r) => ({ row: r, status: status(r) }))
    .sort((a, b) => a.status.rank - b.status.rank || b.row.plannedCents - a.row.plannedCents),
);

const daysLabel = (days: number[]) => (days.length === 1 ? `le ${days[0]}` : `les ${days.join(', ')}`);
// A lone forecast named like its category: its days are enough
const forecastLabel = (r: BudgetRow, f: BudgetRow['forecasts'][number]) =>
  r.forecasts.length === 1 && f.projection.name.trim().toLowerCase() === r.label.trim().toLowerCase()
    ? daysLabel(f.days)
    : `${f.projection.name} · ${daysLabel(f.days)}`;

const progress = (r: BudgetRow) => Math.min(100, (r.actualCents / r.plannedCents) * 100);
</script>

<template>
  <div class="@container flex flex-col gap-4">
    <!-- Net, income and spending, next to each other when the card is wide enough.
         Income and spending open their detail by category below. -->
    <div class="grid gap-4 @xl:grid-cols-3">
      <div class="flex flex-col gap-2 rounded-lg border p-4">
        <h3 class="text-sm text-muted-foreground">{{ isPast ? 'Net' : 'Net estimé du mois' }}</h3>
        <span class="text-2xl font-semibold tabular-nums" :class="netClass(net.estimatedCents)">
          {{ formatCents(net.estimatedCents) }}
        </span>
        <!-- The gap with the forecasts' net, rather than repeating it when equal -->
        <span
          class="text-sm"
          :class="netGap === 0 ? 'text-muted-foreground' : netGap > 0 ? 'text-emerald-600' : 'text-destructive'"
          :title="`Net prévu : ${formatCents(net.plannedCents)}`"
        >
          <template v-if="netGap === 0">Conforme aux prévisions</template>
          <template v-else>
            <span class="tabular-nums">{{ formatCents(Math.abs(netGap)) }}</span>
            de {{ netGap > 0 ? 'plus' : 'moins' }} que prévu
          </template>
        </span>
        <span v-if="!isPast" class="text-sm text-muted-foreground">
          Réel à ce jour <span class="tabular-nums">{{ formatCents(net.actualCents) }}</span>
        </span>
      </div>
      <button
        v-for="s in sections"
        :key="s.kind"
        type="button"
        :aria-expanded="expanded === s.kind"
        class="group flex flex-col gap-2 rounded-lg border p-4 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
        :class="expanded === s.kind && 'border-primary bg-muted/50'"
        @click="toggle(s.kind)"
      >
        <span class="flex items-center justify-between text-sm text-muted-foreground">
          {{ s.title }}
          <span class="flex items-center gap-0.5 text-xs group-hover:text-foreground">
            {{ expanded === s.kind ? 'Masquer' : 'Détail' }}
            <ChevronDown class="size-4 transition-transform" :class="expanded === s.kind && 'rotate-180'" />
          </span>
        </span>
        <span class="flex flex-wrap items-baseline gap-x-2">
          <span class="text-2xl font-semibold tabular-nums">{{ formatCents(s.total.actualCents) }}</span>
          <span class="text-sm text-muted-foreground tabular-nums">
            sur {{ formatCents(s.total.plannedCents) }} prévus
          </span>
        </span>
        <Progress
          v-if="s.total.plannedCents > 0"
          :model-value="Math.min(100, (s.total.actualCents / s.total.plannedCents) * 100)"
          :class="isSectionBad(s) && '*:data-[slot=progress-indicator]:bg-destructive'"
        />
        <span class="flex flex-col gap-0.5 text-sm">
          <span v-if="s.summary.leftCents > 0" class="text-muted-foreground">
            {{ s.kind === 'expense' ? 'Reste à dépenser' : 'Reste à recevoir' }}
            <span class="tabular-nums">{{ formatCents(s.summary.leftCents) }}</span>
          </span>
          <span v-if="s.kind === 'income' && s.summary.lateCents > 0" class="text-destructive">
            En retard <span class="tabular-nums">{{ formatCents(s.summary.lateCents) }}</span>
          </span>
          <span v-if="s.summary.extraCents > 0" :class="s.kind === 'expense' ? 'text-destructive' : 'text-emerald-600'">
            {{ s.kind === 'expense' ? 'Dépassements' : 'En plus' }}
            <span class="tabular-nums">{{ formatCents(s.summary.extraCents) }}</span>
          </span>
          <span
            v-if="s.summary.leftCents === 0 && s.summary.extraCents === 0 && s.total.plannedCents > 0"
            class="text-muted-foreground"
          >
            Comme prévu
          </span>
        </span>
      </button>
    </div>

    <!-- Detail of the opened tile, one line per category -->
    <section v-if="detail" class="flex flex-col gap-2 rounded-lg border px-4 py-2">
      <h3 class="pt-2 text-sm font-medium">{{ detail.title }} par catégorie</h3>
      <!-- One grid for the whole list (rows are subgrids), so the columns line up -->
      <ul class="flex flex-col divide-y @2xl:grid @2xl:grid-cols-[minmax(0,1fr)_7rem_auto_auto] @2xl:gap-x-6">
        <li
          v-for="{ row: r, status: st } in detailRows"
          :key="r.key"
          class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 py-3 text-sm @2xl:col-span-4 @2xl:grid-cols-subgrid"
        >
          <div class="min-w-0">
            <div class="flex items-center gap-2 font-medium">
              <CategoryDot :color="categoryColors.get(r.key)" />
              {{ r.label }}
            </div>
            <!-- The forecasts behind the planned amount: click one to edit it -->
            <div class="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
              <button
                v-for="f in r.forecasts"
                :key="f.projection._id"
                type="button"
                class="underline-offset-4 hover:text-foreground hover:underline"
                :title="`Modifier « ${f.projection.name} »`"
                @click="emit('edit', f.projection)"
              >
                {{ forecastLabel(r, f) }}
              </button>
            </div>
          </div>
          <span class="text-right tabular-nums @2xl:col-start-3 @2xl:row-start-1">
            {{ formatCents(r.actualCents) }}
            <span class="text-muted-foreground">/ {{ formatCents(r.plannedCents) }}</span>
          </span>
          <Progress
            :model-value="progress(r)"
            class="col-span-2 @2xl:col-span-1 @2xl:col-start-2 @2xl:row-start-1"
            :class="r.kind === 'expense' && isBad(r) && '*:data-[slot=progress-indicator]:bg-destructive'"
          />
          <div class="col-span-2 @2xl:col-span-1 @2xl:col-start-4 @2xl:row-start-1 @2xl:justify-self-end">
            <Badge :variant="st.tone === 'done' ? 'secondary' : 'outline'" :class="TONES[st.tone]">
              <Check v-if="st.tone === 'done'" />
              {{ st.label }}
            </Badge>
          </div>
        </li>

        <li
          v-for="r in detail.uncategorized"
          :key="r.key"
          class="flex flex-wrap items-center gap-2 py-3 text-sm @2xl:col-span-4"
        >
          <!-- Editing it is how it gets a category -->
          <button
            type="button"
            class="font-medium underline-offset-4 hover:underline"
            :title="`Modifier « ${r.label} »`"
            @click="emit('edit', r.forecasts[0]!.projection)"
          >
            {{ r.label }}
          </button>
          <span class="ml-auto text-muted-foreground tabular-nums">— / {{ formatCents(r.plannedCents) }}</span>
          <Badge variant="outline" class="text-muted-foreground">Sans catégorie</Badge>
        </li>
      </ul>

      <!-- Spending or income with no forecast: folded, it is often a long list -->
      <Collapsible v-if="detail.unplanned.length > 0" v-model:open="unplannedOpen[detail.kind]" class="border-t py-2">
        <CollapsibleTrigger as-child>
          <Button variant="ghost" size="sm" class="-mx-2 w-[calc(100%+1rem)] justify-start">
            <ChevronRight class="transition-transform" :class="unplannedOpen[detail.kind] && 'rotate-90'" />
            Non prévu ({{ detail.unplanned.length }})
            <span class="ml-auto tabular-nums">{{ formatCents(detail.unplannedCents) }}</span>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ul class="flex flex-col gap-2 pt-2 pl-6">
            <li v-for="r in detail.unplanned" :key="r.key" class="flex items-center gap-2 text-sm">
              <CategoryDot :color="categoryColors.get(r.key)" />
              <span>{{ r.label }}</span>
              <span class="ml-auto tabular-nums">{{ formatCents(r.actualCents) }}</span>
            </li>
          </ul>
        </CollapsibleContent>
      </Collapsible>

      <p v-if="detail.uncategorized.length > 0" class="pb-2 text-sm text-muted-foreground">
        Les prévisions « Sans catégorie » ne peuvent pas être comparées : clique dessus pour leur associer une
        catégorie.
      </p>
    </section>
  </div>
</template>
