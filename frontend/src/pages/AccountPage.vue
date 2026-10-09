<script setup lang="ts">
// One account, opened from its tile on the phone home: its balance over the
// period picked (the spending tab's chart), and where its spending went (the
// analysis' donut). Editing it stays in the account dialog, from the top right.
import type { ChartSelection, Period } from '@/lib/chartData';
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { Pencil } from '@lucide/vue';
import { formatCents, formatCentsCompact } from '@/api';
import { useFinanceData } from '@/composables/useFinanceData';
import {
  accountSeries,
  balanceOverTime,
  expenseSeries,
  expensesByMonth,
  periodStart,
  selectedExpenses,
  PERIODS,
} from '@/lib/chartData';
import type { Month } from '@/lib/projections';
import { addMonths, currentMonth, monthLabel, sameMonth } from '@/lib/projections';
import { ACCOUNT_TYPES } from '@/lib/labels';
import type { Transaction } from '@/types';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableEmpty } from '@/components/ui/table';
import AccountForm from '@/components/AccountForm.vue';
import AccountLogo from '@/components/AccountLogo.vue';
import TrendChart from '@/components/TrendChart.vue';
import ExpensesDonut from '@/components/charts/ExpensesDonut.vue';
import SelectedTransactions from '@/components/charts/SelectedTransactions.vue';
import PageBar from '@/components/PageBar.vue';
import TransactionEditDialog from '@/components/TransactionEditDialog.vue';
import TransactionRow from '@/components/TransactionRow.vue';

const props = defineProps<{ id: string }>();

const router = useRouter();
const { accounts, categories, categoryGroups, categoryColors, transactions, refresh, setError } = useFinanceData();

const account = computed(() => accounts.value.find((a) => a._id === props.id));
// Deleted from its dialog (or a stale address): back home
watch(account, (a) => {
  if (!a && accounts.value.length > 0) router.replace('/');
});

// Back where it was opened from, or home when opened directly
function back() {
  if (router.options.history.state.back) router.back();
  else router.push('/');
}

// The analysis' periods. "Mois par mois" shows one month at a time, stepped
// with arrows, like the analysis card (DashboardCharts)
const period = ref<Period>('3m');
const month = ref<Month>(currentMonth());
const isCurrentMonth = computed(() => sameMonth(month.value, currentMonth()));
const monthStart = (m: Month) => new Date(Date.UTC(m.year, m.month, 1));

const from = computed(() => (period.value === 'month' ? monthStart(month.value) : periodStart(period.value)));
// A past month ends on its last day: later transactions are left out, and the
// charts stop there instead of today
const end = computed(() =>
  period.value === 'month' && !isCurrentMonth.value ? monthStart(addMonths(month.value, 1)) : null,
);
const now = computed(() => (end.value ? new Date(end.value.getTime() - 1) : new Date()));

const accountTransactions = computed(() =>
  transactions.value.filter((t) => t.account?._id === props.id && (!end.value || new Date(t.date) < end.value)),
);

// Balance after each day with transactions, from the start of the period
const balanceRows = computed(() =>
  account.value
    ? balanceOverTime(accountTransactions.value, [account.value], accountSeries([account.value]), from.value, now.value)
    : [],
);
const balance = computed(() => balanceRows.value.map((r) => Number(r.total)));
// Each balance at its date: transactions do not come at a regular pace
const balanceTimes = computed(() => balanceRows.value.map((r) => r.t));
const change = computed(() => (balance.value.at(-1) ?? 0) - (balance.value[0] ?? 0));

// The period's spending by category, as in the analysis
const expenses = computed(() =>
  expenseSeries(
    accountTransactions.value,
    categories.value,
    categoryGroups.value,
    categoryColors.value,
    false,
    from.value,
  ),
);
const expenseRows = computed(() => expensesByMonth(accountTransactions.value, expenses.value, from.value, now.value));

// Tapped slice, and the expenses behind it
const selection = ref<ChartSelection | null>(null);
watch([period, month], () => (selection.value = null));
const selectedTransactions = computed(() =>
  selectedExpenses(accountTransactions.value, selection.value, expenses.value.keyOf, from.value),
);

// The account's transactions over the period, newest first, a page at a time
const PAGE_SIZE = 50;
const shown = ref(PAGE_SIZE);
watch([period, month, () => props.id], () => (shown.value = PAGE_SIZE));
const periodTransactions = computed(() =>
  accountTransactions.value
    .filter((t) => !from.value || new Date(t.date) >= from.value)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
);

// One edit popup for the whole list
const editing = ref<Transaction | null>(null);
const editOpen = ref(false);
function edit(t: Transaction) {
  editing.value = t;
  editOpen.value = true;
}
</script>

<template>
  <div v-if="account" class="mx-auto flex w-full max-w-2xl min-w-0 flex-col gap-6">
    <!-- Back, and the period (with its month) -->
    <PageBar v-model:period="period" v-model:month="month" back :periods="PERIODS" up-to-now @back="back" />

    <section class="flex flex-col gap-4">
      <div class="flex items-center gap-3">
        <AccountLogo :account="account" />
        <div class="min-w-0">
          <h2 class="truncate text-lg font-semibold">{{ account.name }}</h2>
          <p class="text-sm text-muted-foreground">{{ ACCOUNT_TYPES[account.type] ?? account.type }}</p>
        </div>
        <!-- The action on the account's line, top right -->
        <AccountForm :account="account" :accounts="accounts" @changed="refresh" @error="setError">
          <Button
            variant="ghost"
            aria-label="Modifier le compte"
            title="Modifier le compte"
            class="ml-auto max-sm:size-9"
          >
            <Pencil />
            <span class="max-sm:sr-only">Modifier</span>
          </Button>
        </AccountForm>
      </div>

      <div class="flex items-start gap-4">
        <div class="mr-auto min-w-0">
          <p class="text-[clamp(2rem,11vw,3rem)] leading-none font-semibold tracking-tight tabular-nums">
            {{ formatCents(end ? (balance.at(-1) ?? 0) : account.balanceCents, account.currency) }}
          </p>
          <!-- A past month: the balance it ended on -->
          <p class="mt-1 text-sm font-medium text-muted-foreground">
            {{ end ? `Solde à la fin de ${monthLabel(month)}` : 'Solde actuel' }}
          </p>
        </div>
        <div class="shrink-0 pt-1 text-right text-sm whitespace-nowrap">
          <p class="text-muted-foreground">Variation</p>
          <p class="font-semibold tabular-nums" :class="change < 0 ? 'text-destructive' : 'text-emerald-600'">
            {{ change > 0 ? '+' : '' }}{{ formatCents(change, account.currency) }}
          </p>
        </div>
      </div>

      <!-- Edge to edge on a phone: out of the page's side padding -->
      <TrendChart
        :values="balance"
        :x="balanceTimes"
        :height="240"
        main-label="Solde"
        :format="(v: number) => formatCents(v, account!.currency)"
        :format-axis="(v: number) => formatCentsCompact(v, account!.currency)"
        class="-mx-4 md:mx-0 md:[--chart-gutter:0px]"
      />
    </section>

    <section class="flex flex-col gap-2 border-t pt-6">
      <h3 class="text-lg font-semibold">Dépenses par catégorie</h3>
      <p v-if="expenseRows.length === 0" class="py-8 text-center text-sm text-muted-foreground">
        Aucune dépense sur cette période.
      </p>
      <template v-else>
        <ExpensesDonut :rows="expenseRows" :series="expenses.series" @select="selection = $event" />
        <SelectedTransactions :selection="selection" :transactions="selectedTransactions" @close="selection = null" />
      </template>
    </section>

    <section class="flex flex-col gap-2 border-t pt-6">
      <h3 class="text-lg font-semibold">Transactions</h3>
      <p class="text-sm text-muted-foreground">
        {{ periodTransactions.length }} transaction(s) sur cette période, les plus récentes en premier.
      </p>
      <div class="@container">
        <Table>
          <TableBody>
            <TransactionRow
              v-for="t in periodTransactions.slice(0, shown)"
              :key="t._id"
              :transaction="t"
              hide-account
              @edit="edit(t)"
              @changed="refresh"
              @error="setError"
            />
            <TableEmpty v-if="periodTransactions.length === 0" :colspan="4">Aucune transaction</TableEmpty>
          </TableBody>
        </Table>
      </div>
      <Button
        v-if="periodTransactions.length > shown"
        variant="outline"
        class="self-center"
        @click="shown += PAGE_SIZE"
      >
        Afficher plus
      </Button>
      <TransactionEditDialog
        v-model:open="editOpen"
        :transaction="editing"
        :accounts="accounts"
        :categories="categories"
        @changed="refresh"
      />
    </section>
  </div>
</template>
