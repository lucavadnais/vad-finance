<script setup lang="ts">
// Phone home tab: the accounts card taken apart. Each part is a preview of
// the tab it opens, with that tab's figure, small: the total and its curve
// (the analysis), then two tiles, this month's spending against the usual (its
// tab) and what is left of the budget (the budget's); then each account on its
// own tile, opening its page.
import type { Account, Category, Projection, Transaction } from '@/types';
import type { HomeTab } from './MobileTabBar.vue';
import { computed } from 'vue';
import { ChevronRight, Eye, EyeOff, Plus } from '@lucide/vue';
import { formatCents } from '@/api';
import { useAmountsHidden } from '@/composables/useAmountsHidden';
import { useFinanceData } from '@/composables/useFinanceData';
import { budget, estimatedMonth } from '@/lib/budget';
import { accountSeries, balanceOverTime } from '@/lib/chartData';
import { ACCOUNT_TYPES } from '@/lib/labels';
import { currentMonth, monthLabel } from '@/lib/projections';
import { dailySpending, medianRunningTotal, runningTotal, vsUsualPercent } from '@/lib/spending';
import { Button } from '@/components/ui/button';
import AccountForm from './AccountForm.vue';
import AccountLogo from './AccountLogo.vue';
import Sparkline from './Sparkline.vue';
import VsUsual from './VsUsual.vue';

const props = defineProps<{
  accounts: Account[];
  transactions: Transaction[];
  projections: Projection[];
  categories: Category[];
}>();
const emit = defineEmits<{ open: [tab: HomeTab]; changed: []; error: [message: string] }>();

const { amountsHidden, toggle: toggleAmounts } = useAmountsHidden();
const totalCents = computed(() => props.accounts.reduce((sum, a) => sum + a.balanceCents, 0));

const { settings } = useFinanceData();
const month = currentMonth();
const monthName = monthLabel(month).replace(/ \d+$/, '');

// Under the total, opening the analysis (whose top is the same balance and
// curve): the total balance over the last 30 days, and how much it moved
const balance = computed(() => {
  const from = new Date(Date.now() - 30 * 86_400_000);
  return balanceOverTime(props.transactions, props.accounts, accountSeries(props.accounts), from).map((r) =>
    Number(r.total),
  );
});
const balanceChange = computed(() => (balance.value.at(-1) ?? 0) - (balance.value[0] ?? 0));

// Spending tile, opening its tab: spent so far this month, against the usual
// spending by the same day (the median of the three months before, the gray
// line of the tab's chart). Null without history to compare with.
const today = new Date().getUTCDate();
const spentCents = computed(() => runningTotal(dailySpending(props.transactions, month))[today - 1] ?? 0);
const vsUsual = computed(() =>
  vsUsualPercent(spentCents.value, medianRunningTotal(props.transactions, month)?.[today - 1]),
);

// Budget tile, opening its tab (its net tile, summed up): the month's
// estimated net, and a gauge from the middle: green to the right for a
// surplus, red to the left for a deficit, as long as the net is big against
// the month's flows. Estimated, not actual: a payday would swing it
const estimate = computed(() =>
  estimatedMonth(
    budget(props.projections, props.transactions, props.categories, month),
    settings.value.budgetBufferCents,
    false,
  ),
);
// Half the gauge's width at most: a net as big as the month's biggest side
// (all income kept, or spending with no income) fills its half
const netShare = computed(() => {
  const { incomeCents, spendingCents, netCents } = estimate.value;
  const scale = Math.max(incomeCents, spendingCents);
  return scale > 0 ? Math.min(50, (Math.abs(netCents) / scale) * 50) : null;
});
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- The total centered on the page, the eye beside it in an equal side
         column; the figure shrinks with the screen so a big one still fits.
         Under it, its curve over 30 days. The whole of it opens the analysis,
         through a button stretched over it (the eye sits above it). -->
    <section class="relative flex flex-col gap-1 pt-2 text-center">
      <button
        type="button"
        class="absolute inset-0 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        aria-label="Voir l'analyse du solde"
        @click="emit('open', 'analysis')"
      />
      <p class="grid grid-cols-[minmax(2rem,1fr)_auto_minmax(2rem,1fr)] items-center">
        <span
          class="col-start-2 text-[clamp(1.75rem,9vw,2.25rem)] leading-tight font-semibold tracking-tight tabular-nums"
        >
          {{ formatCents(totalCents) }}
        </span>
        <Button
          size="icon-sm"
          variant="ghost"
          class="relative z-10 ml-1 text-muted-foreground"
          :aria-label="amountsHidden ? 'Afficher les montants' : 'Masquer les montants'"
          :aria-pressed="amountsHidden"
          @click="toggleAmounts"
        >
          <EyeOff v-if="amountsHidden" />
          <Eye v-else />
        </Button>
      </p>
      <!-- How much the total moved over the curve's 30 days -->
      <p class="flex flex-wrap items-center justify-center gap-x-1.5 text-sm font-medium text-muted-foreground">
        <span class="tabular-nums" :class="balanceChange < 0 ? 'text-destructive' : 'text-emerald-600'">
          {{ balanceChange > 0 && !amountsHidden ? '+' : '' }}{{ formatCents(balanceChange) }}
        </span>
        sur 30 jours
        <ChevronRight class="-ml-0.5 size-4" />
      </p>
      <!-- Same color as the change; edge to edge, out of the page's side padding -->
      <Sparkline
        :values="balance"
        :color="balanceChange < 0 ? 'var(--destructive)' : 'var(--color-emerald-600)'"
        class="-mx-4 mt-2 h-20 w-[calc(100%+2rem)]!"
      />
    </section>

    <!-- Tiles: a figure and a hint of the tab they open -->
    <section class="grid grid-cols-2 gap-4">
      <button
        type="button"
        class="flex h-40 min-w-0 flex-col overflow-hidden rounded-xl border bg-card p-4 text-left shadow-sm"
        @click="emit('open', 'spending')"
      >
        <span class="truncate text-sm text-muted-foreground first-letter:uppercase">Dépensé · {{ monthName }}</span>
        <span class="truncate font-semibold tabular-nums">{{ formatCents(spentCents) }}</span>
        <!-- Against the usual by this day: red above it, green below -->
        <VsUsual v-if="vsUsual !== null" :percent="vsUsual" class="mt-auto" />
      </button>
      <button
        type="button"
        class="flex h-40 min-w-0 flex-col overflow-hidden rounded-xl border bg-card p-4 text-left shadow-sm"
        @click="emit('open', 'budget')"
      >
        <span class="truncate text-sm text-muted-foreground first-letter:uppercase">Budget · {{ monthName }}</span>
        <template v-if="netShare !== null">
          <span
            class="truncate font-semibold tabular-nums"
            :class="estimate.netCents < 0 ? 'text-destructive' : estimate.netCents > 0 ? 'text-emerald-600' : ''"
          >
            {{ estimate.netCents > 0 && !amountsHidden ? '+' : '' }}{{ formatCents(estimate.netCents) }}
          </span>
          <span class="text-sm text-muted-foreground">Net estimé</span>
          <!-- From the middle: green to the right (surplus), red to the left (deficit) -->
          <span class="mt-auto flex flex-col gap-1.5">
            <span class="relative h-3 overflow-hidden rounded-full bg-muted">
              <span
                class="absolute inset-y-0"
                :class="
                  estimate.netCents < 0
                    ? 'right-1/2 rounded-l-full bg-destructive'
                    : 'left-1/2 rounded-r-full bg-emerald-600'
                "
                :style="{ width: `${netShare}%` }"
              />
              <span class="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-foreground/40" />
            </span>
            <span class="flex justify-between text-xs text-muted-foreground">
              <span>Déficit</span>
              <span>Surplus</span>
            </span>
          </span>
        </template>
        <span v-else class="mt-auto text-sm text-muted-foreground">Aucune prévision ce mois-ci</span>
      </button>
    </section>

    <section class="flex flex-col gap-3">
      <h2 class="text-lg font-semibold">Comptes</h2>
      <RouterLink
        v-for="a in accounts"
        :key="a._id"
        :to="{ name: 'account', params: { id: a._id } }"
        class="flex items-center gap-3 rounded-xl border bg-card p-4 text-left shadow-sm"
      >
        <AccountLogo :account="a" />
        <span class="flex min-w-0 flex-col">
          <span class="truncate font-medium">{{ a.name }}</span>
          <span class="text-sm text-muted-foreground">{{ ACCOUNT_TYPES[a.type] ?? a.type }}</span>
        </span>
        <span class="ml-auto shrink-0 font-medium tabular-nums">{{ formatCents(a.balanceCents, a.currency) }}</span>
      </RouterLink>
      <!-- Adding one: a tile shaped like the accounts above it, dashed outline;
           as tall as an account tile (name and type lines) -->
      <AccountForm @created="emit('changed')" @error="emit('error', $event)">
        <button
          type="button"
          class="flex min-h-19 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/40 bg-card p-4 text-sm font-medium text-foreground/80 shadow-sm"
        >
          Ajouter un compte
          <Plus class="size-5 shrink-0" />
        </button>
      </AccountForm>
    </section>
  </div>
</template>
