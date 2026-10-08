<script setup lang="ts">
// Phone home tab: the accounts card taken apart. The total, centered; two
// tiles with a trend that open their tab (this month's spending, the balance
// over 30 days); then each account on its own tile, opening its page.
import type { Account, Category, Projection, Transaction } from '@/types';
import type { HomeTab } from './MobileTabBar.vue';
import { computed } from 'vue';
import { Eye, EyeOff, Plus } from '@lucide/vue';
import { formatCents } from '@/api';
import { useAmountsHidden } from '@/composables/useAmountsHidden';
import { useFinanceData } from '@/composables/useFinanceData';
import { budget, budgetSection } from '@/lib/budget';
import { accountSeries, balanceOverTime } from '@/lib/chartData';
import { ACCOUNT_TYPES } from '@/lib/labels';
import { currentMonth, monthLabel } from '@/lib/projections';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import AccountForm from './AccountForm.vue';
import AccountLogo from './AccountLogo.vue';
import Sparkline from './Sparkline.vue';

const props = defineProps<{
  accounts: Account[];
  transactions: Transaction[];
  projections: Projection[];
  categories: Category[];
}>();
const emit = defineEmits<{ open: [tab: HomeTab]; changed: []; error: [message: string] }>();

const { amountsHidden, toggle: toggleAmounts } = useAmountsHidden();
const totalCents = computed(() => props.accounts.reduce((sum, a) => sum + a.balanceCents, 0));

// This month's spending against its budget, as the budget's spending tile
// counts it (buffer included, overruns past it)
const { settings } = useFinanceData();
const month = currentMonth();
const spending = computed(() =>
  budgetSection(
    budget(props.projections, props.transactions, props.categories, month).expense,
    settings.value.budgetBufferCents,
  ),
);
const spendingProgress = computed(() => {
  const { plannedCents, actualCents } = spending.value.total;
  return plannedCents > 0 ? Math.min(100, (actualCents / plannedCents) * 100) : null;
});
// The total balance over the last 30 days, and how much it moved
const balance = computed(() => {
  const from = new Date(Date.now() - 30 * 86_400_000);
  return balanceOverTime(props.transactions, props.accounts, accountSeries(props.accounts), from).map((r) =>
    Number(r.total),
  );
});
const balanceChange = computed(() => (balance.value.at(-1) ?? 0) - (balance.value[0] ?? 0));
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- The total centered on the page, the eye beside it in an equal side
         column; the figure shrinks with the screen so a big one still fits -->
    <section class="flex flex-col gap-1 py-2 text-center">
      <p class="grid grid-cols-[minmax(2rem,1fr)_auto_minmax(2rem,1fr)] items-center">
        <span
          class="col-start-2 text-[clamp(1.75rem,9vw,2.25rem)] leading-tight font-semibold tracking-tight tabular-nums"
        >
          {{ formatCents(totalCents) }}
        </span>
        <Button
          size="icon-sm"
          variant="ghost"
          class="ml-1 text-muted-foreground"
          :aria-label="amountsHidden ? 'Afficher les montants' : 'Masquer les montants'"
          :aria-pressed="amountsHidden"
          @click="toggleAmounts"
        >
          <EyeOff v-if="amountsHidden" />
          <Eye v-else />
        </Button>
      </p>
      <p class="text-sm font-medium text-muted-foreground">Total des comptes</p>
    </section>

    <!-- Tiles: a figure and where it stands, tapped to open the tab with the detail -->
    <section class="grid grid-cols-2 gap-4">
      <button
        type="button"
        class="flex h-44 min-w-0 flex-col overflow-hidden rounded-xl border bg-card pt-4 text-left shadow-sm"
        @click="emit('open', 'spending')"
      >
        <span class="truncate px-4 text-sm text-muted-foreground first-letter:uppercase">
          Dépenses · {{ monthLabel(month).replace(/ \d+$/, '') }}
        </span>
        <span class="truncate px-4 font-semibold tabular-nums">{{ formatCents(spending.total.actualCents) }}</span>
        <!-- Against the month's budget: how much of it is spent, and what is left
             or went over -->
        <span v-if="spendingProgress !== null" class="truncate px-4 text-sm text-muted-foreground tabular-nums">
          sur {{ formatCents(spending.total.plannedCents) }}
        </span>
        <span v-if="spendingProgress !== null" class="mt-auto flex w-full flex-col gap-2 px-4 pb-4">
          <Progress
            :model-value="spendingProgress"
            class="h-2.5"
            :class="spending.summary.overrunCents > 0 && '*:data-[slot=progress-indicator]:bg-destructive'"
          />
          <span v-if="spending.summary.overrunCents > 0" class="truncate text-sm text-destructive tabular-nums">
            Dépassé de {{ formatCents(spending.summary.overrunCents) }}
          </span>
          <span v-else class="truncate text-sm tabular-nums">
            Reste <span class="font-semibold">{{ formatCents(spending.summary.leftCents) }}</span>
          </span>
        </span>
        <span v-else class="mt-auto px-4 pb-4 text-sm text-muted-foreground">Aucune prévision ce mois-ci</span>
      </button>
      <button
        type="button"
        class="flex h-44 min-w-0 flex-col overflow-hidden rounded-xl border bg-card pt-4 text-left shadow-sm"
        @click="emit('open', 'analysis')"
      >
        <span class="truncate px-4 text-sm text-muted-foreground">Solde · 30 jours</span>
        <span
          class="truncate px-4 font-semibold tabular-nums"
          :class="balanceChange < 0 ? 'text-destructive' : 'text-emerald-600'"
        >
          {{ balanceChange > 0 && !amountsHidden ? '+' : '' }}{{ formatCents(balanceChange) }}
        </span>
        <!-- Same color as the change above it -->
        <Sparkline
          :values="balance"
          :color="balanceChange < 0 ? 'var(--destructive)' : 'var(--color-emerald-600)'"
          class="mt-auto h-20"
        />
      </button>
    </section>

    <section class="flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold">Comptes</h2>
        <AccountForm @created="emit('changed')" @error="emit('error', $event)">
          <!-- Like the budget card's actions: the app's regular button, icon only on a phone -->
          <Button class="size-9" aria-label="Ajouter un compte" title="Ajouter un compte">
            <Plus />
          </Button>
        </AccountForm>
      </div>
      <p v-if="accounts.length === 0" class="text-sm text-muted-foreground">Aucun compte pour l'instant.</p>
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
    </section>
  </div>
</template>
