<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ChartLine, Eye, EyeOff, Landmark, Pencil, Plus, Table2, X } from '@lucide/vue';
import { formatCents } from '@/api';
import { useAmountsHidden } from '@/composables/useAmountsHidden';
import { useFinanceData } from '@/composables/useFinanceData';
import { useSelectedAccount } from '@/composables/useSelectedAccount';
import { useSelectedMonth, useSelectedPeriod } from '@/composables/useSelectedMonth';
import { duplicateKey, useDuplicateReview } from '@/composables/useDuplicateReview';
import { useTransferReview } from '@/composables/useTransferReview';
import { TOTAL_SERIES, accountSeries, balanceOverTime, periodStart } from '@/lib/chartData';
import { addMonths, currentMonth, sameMonth } from '@/lib/projections';
import { useMediaQuery } from '@vueuse/core';
import type { Row } from '@/lib/chartData';
import { ACCOUNT_TYPES } from '@/lib/labels';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AccountForm from '@/components/AccountForm.vue';
import AccountLogo from '@/components/AccountLogo.vue';
import CsvImport from '@/components/CsvImport.vue';
import EmptyState from '@/components/EmptyState.vue';
import MobileTabBar, { type HomeTab } from '@/components/MobileTabBar.vue';
import DuplicateDialog from '@/components/DuplicateDialog.vue';
import MobileAddSheet from '@/components/MobileAddSheet.vue';
import MobileHome from '@/components/MobileHome.vue';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TrendChart from '@/components/TrendChart.vue';
import SeriesTable from '@/components/charts/SeriesTable.vue';
import ProjectionMonth from '@/components/ProjectionMonth.vue';
import SpendInsights from '@/components/SpendInsights.vue';
import TransactionsTable from '@/components/TransactionsTable.vue';
import TransferDialog from '@/components/TransferDialog.vue';

// Charts pull in Unovis (~1 MB): load them in their own chunk
const DashboardCharts = defineAsyncComponent(() => import('@/components/charts/DashboardCharts.vue'));

const {
  accounts,
  categories,
  categoryGroups,
  transactions,
  dataVersion,
  transferCandidates,
  duplicatePairs,
  projections,
  refresh,
  setError,
} = useFinanceData();

// After an import or a new transaction, the pairs it brought open their dialog
// (the ones already found before stay behind their icon). Duplicates first,
// the transfers once that dialog is closed, never both at once.
const transferReview = useTransferReview();
const duplicateReview = useDuplicateReview();
let pendingTransfers: string[] = [];
async function refreshAfterAdd() {
  const transfersBefore = new Set(transferCandidates.value.map((c) => c.out._id));
  const duplicatesBefore = new Set(duplicatePairs.value.map(duplicateKey));
  await refresh();
  const newTransfers = transferCandidates.value.filter((c) => !transfersBefore.has(c.out._id));
  const newDuplicates = duplicatePairs.value.filter((p) => !duplicatesBefore.has(duplicateKey(p)));
  if (newDuplicates.length > 0) {
    pendingTransfers = newTransfers.map((c) => c.out._id);
    duplicateReview.review(newDuplicates);
  } else transferReview.review(newTransfers);
}
watch(duplicateReview.open, (open) => {
  if (open || pendingTransfers.length === 0) return;
  // Deleting a duplicate may have removed a pair in the meantime
  transferReview.review(transferCandidates.value.filter((c) => pendingTransfers.includes(c.out._id)));
  pendingTransfers = [];
});

// The eye next to the total hides every amount in the app
const { amountsHidden, toggle: toggleAmounts } = useAmountsHidden();

// An account clicked in the card shows only it: its balance and curve, its
// spending in the spending card, its transactions (useSelectedAccount).
// Clicked again, or the cross by its name, back to all of them
const selectedId = useSelectedAccount();
const selected = computed(() => accounts.value.find((a) => a._id === selectedId.value));
const shownAccounts = computed(() => (selected.value ? [selected.value] : accounts.value));
const toggleAccount = (id: string) => (selectedId.value = selectedId.value === id ? 'all' : id);
// Deleted from its dialog
watch(selected, (a) => {
  if (!a && selectedId.value !== 'all' && accounts.value.length > 0) selectedId.value = 'all';
});

const totalCents = computed(() => shownAccounts.value.reduce((sum, a) => sum + a.balanceCents, 0));
// Under it, how it moved over the period of the page's header, as a curve or
// a table. "Mois par mois": over the month picked beside it (a past one up to
// its last day, nothing for one to come)
const period = useSelectedPeriod();
const projectionMonth = useSelectedMonth();
const monthStart = (m: { year: number; month: number }) => new Date(Date.UTC(m.year, m.month, 1));
const balanceRows = computed(() => {
  const m = projectionMonth.value;
  const byMonth = period.value === 'month';
  const now = currentMonth();
  if (byMonth && monthStart(m) > monthStart(now)) return [];
  const end = byMonth && !sameMonth(m, now) ? monthStart(addMonths(m, 1)) : null;
  return balanceOverTime(
    transactions.value.filter(
      (t) => (!selected.value || t.account?._id === selected.value._id) && (!end || new Date(t.date) < end),
    ),
    shownAccounts.value,
    accountSeries(shownAccounts.value),
    byMonth ? monthStart(m) : periodStart(period.value),
    end ? new Date(end.getTime() - 1) : undefined,
  );
});
const balanceTimes = computed(() => balanceRows.value.map((r) => r.t));
const balanceTotals = computed(() => balanceRows.value.map((r) => Number(r.total ?? 0)));
const balanceChange = computed(() => (balanceTotals.value.at(-1) ?? 0) - (balanceTotals.value[0] ?? 0));
const formatRowDate = (row: Row) => new Date(row.t).toLocaleDateString('fr-CA', { timeZone: 'UTC' });

// The budget is by month: with another period than "Mois par mois" in the
// header (computer), the current one. A phone picks its month in the tab's bar
const phone = useMediaQuery('(max-width: 767px)');
const budgetMonth = computed({
  get: () => (phone.value || period.value === 'month' ? projectionMonth.value : currentMonth()),
  set: (m) => (projectionMonth.value = m),
});

// On a phone, one tab at a time, picked in the bottom tab bar: the home (the
// accounts card taken apart), the spending (the month's spending, the import
// and the transactions, all flat), the budget and the analysis. From tablet
// up, every card shows. Each tab has its address (router.ts): the tab follows
// it, so the back button and a reload work as with pages.
const TABS: HomeTab[] = ['home', 'spending', 'budget', 'analysis'];
const route = useRoute();
const router = useRouter();
const tab = computed<HomeTab>({
  get: () => TABS.find((t) => t === route.name) ?? 'home',
  set: (t) => router.push({ name: t }),
});
const onPhone = (t: HomeTab) => tab.value !== t && 'max-md:hidden';
watch(tab, () => window.scrollTo({ top: 0 }));
// Phone: the add sheet, opened by the "+" of the tab bar
const addOpen = ref(false);
const tabAlerts = computed(() => ({
  spending: transferCandidates.value.length > 0 || duplicatePairs.value.length > 0,
}));
</script>

<template>
  <!-- Phone and portrait tablet: one column (accounts, adding transactions, the
       transactions, then the rest). Landscape tablet: accounts and import side
       by side, transactions below them. Desktop: the three become a sidebar
       next to forecasts and charts -->
  <!-- Phone: room at the bottom for the tab bar -->
  <div class="grid grid-cols-1 gap-6 max-md:pb-24 lg:grid-cols-2 xl:grid-cols-[minmax(32rem,2fr)_3fr]">
    <!-- Desktop: [contain:size] keeps the sidebar out of the row height, so it
         stretches to the forecasts and charts column, and the transactions fill
         what is left (scrolling inside) instead of pushing the page longer. When
         that column is short, the transactions keep a minimum height (a few
         rows besides their header and pagination) and the page grows instead -->
    <aside class="contents xl:flex xl:flex-col xl:gap-6 xl:[contain:size]">
      <MobileHome
        :accounts="accounts"
        :transactions="transactions"
        :projections="projections"
        :categories="categories"
        class="md:hidden"
        :class="onPhone('home')"
        @open="tab = $event"
        @changed="refresh"
        @error="setError"
      />

      <!-- The total of the accounts is the page's headline figure: the biggest
           number, above the budget's net, on the night surface. It holds the
           balance's curve too (the analysis keeps the spending) -->
      <!-- Phone: taken apart in the home tab (MobileHome) -->
      <Card class="surface-night max-md:hidden">
        <CardHeader>
          <!-- Titled like the other cards -->
          <CardTitle class="flex min-h-8 items-center text-lg">Comptes</CardTitle>
          <!-- The whole width to itself: the biggest figure of the page, the
               eye that hides every amount beside it -->
          <p class="mt-2 flex min-w-0 items-center gap-2">
            <span
              class="truncate text-[clamp(2.5rem,4vw,3.75rem)] leading-none font-semibold tracking-tight tabular-nums"
              :class="totalCents < 0 && 'text-destructive'"
            >
              {{ formatCents(totalCents, selected?.currency) }}
            </span>
            <Button
              size="icon-sm"
              variant="ghost"
              class="shrink-0 text-muted-foreground"
              :aria-label="amountsHidden ? 'Afficher les montants' : 'Masquer les montants'"
              :title="amountsHidden ? 'Afficher les montants' : 'Masquer les montants'"
              :aria-pressed="amountsHidden"
              @click="toggleAmounts"
            >
              <EyeOff v-if="amountsHidden" />
              <Eye v-else />
            </Button>
          </p>
          <!-- An account picked: a chip under the figure, its cross back to all -->
          <span
            v-if="selected"
            class="mt-1 flex w-fit max-w-full items-center gap-1.5 rounded-full bg-white/10 py-0.5 pr-0.5 pl-2.5 text-sm font-medium"
          >
            <span class="truncate">{{ selected.name }}</span>
            <Button
              size="icon-xs"
              variant="ghost"
              class="rounded-full"
              aria-label="Tous les comptes"
              title="Tous les comptes"
              @click="selectedId = 'all'"
            >
              <X />
            </Button>
          </span>
        </CardHeader>
        <CardContent class="flex flex-col gap-4">
          <!-- How the total moved over the period: the change, the period and
               the view, then the curve edge to edge in the card (or the table) -->
          <Tabs v-if="balanceRows.length > 1" default-value="chart" class="gap-3">
            <div class="flex flex-wrap items-center gap-2">
              <p class="mr-auto text-sm text-muted-foreground">
                <span
                  class="font-medium tabular-nums"
                  :class="balanceChange < 0 ? 'text-destructive' : 'text-emerald-600'"
                  >{{ balanceChange > 0 && !amountsHidden ? '+' : '' }}{{ formatCents(balanceChange) }}</span
                >
                sur la période
              </p>
              <TabsList>
                <TabsTrigger value="chart" aria-label="Graphique" title="Graphique"><ChartLine /></TabsTrigger>
                <TabsTrigger value="table" aria-label="Tableau" title="Tableau"><Table2 /></TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="chart">
              <TrendChart
                :values="balanceTotals"
                :x="balanceTimes"
                :height="200"
                main-label="Solde"
                class="-mx-6 [--chart-gutter:24px]"
              />
            </TabsContent>
            <TabsContent value="table">
              <SeriesTable
                :rows="[...balanceRows].reverse()"
                :series="[TOTAL_SERIES]"
                bucket-label="Date"
                :format-bucket="formatRowDate"
              />
            </TabsContent>
          </Tabs>
          <!-- None yet: the empty list offers the first one, in place of the
               dashed button -->
          <EmptyState
            v-if="accounts.length === 0"
            :icon="Landmark"
            title="Aucun compte pour l'instant"
            description="Ajoutez un compte pour suivre son solde."
          >
            <AccountForm @created="refresh" @error="setError">
              <Button>
                <Plus />
                Ajouter un compte
              </Button>
            </AccountForm>
          </EmptyState>
          <!-- Each account picks itself (or back to all, when it is the one picked);
               the others dim while one is -->
          <ul v-else class="-mx-2 flex flex-col gap-1">
            <li
              v-for="a in accounts"
              :key="a._id"
              class="flex items-center gap-1 rounded-lg pr-1 text-sm transition-colors"
              :class="[
                a._id === selectedId ? 'bg-white/10' : 'hover:bg-white/5',
                selected && a !== selected && 'opacity-60',
              ]"
            >
              <button
                type="button"
                class="flex min-w-0 flex-1 items-center gap-2 rounded-lg p-2 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                :aria-pressed="a._id === selectedId"
                :title="a._id === selectedId ? 'Afficher tous les comptes' : `N'afficher que ${a.name}`"
                @click="toggleAccount(a._id)"
              >
                <AccountLogo :account="a" />
                <!-- On mobile, the type wraps under the name rather than squeezing it -->
                <span class="flex min-w-0 flex-wrap gap-x-2">
                  <span class="font-medium">{{ a.name }}</span>
                  <span class="text-muted-foreground">({{ ACCOUNT_TYPES[a.type] ?? a.type }})</span>
                </span>
                <span class="ml-auto tabular-nums">{{ formatCents(a.balanceCents, a.currency) }}</span>
              </button>
              <AccountForm :account="a" :accounts="accounts" @changed="refresh" @error="setError">
                <Button size="icon-sm" variant="ghost" :aria-label="`Modifier ${a.name}`" :title="`Modifier ${a.name}`">
                  <Pencil />
                </Button>
              </AccountForm>
            </li>
          </ul>
          <!-- Adding one: under the accounts, dashed, as on the phone's home -->
          <AccountForm v-if="accounts.length > 0" @created="refresh" @error="setError">
            <button
              type="button"
              class="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/40 p-3 text-sm font-medium text-foreground/80 transition-colors hover:bg-muted/50"
            >
              Ajouter un compte
              <Plus class="size-5 shrink-0" />
            </button>
          </AccountForm>
        </CardContent>
      </Card>

      <!-- Not scroll anchors (both): on a phone they follow the month card, and
           when it gets shorter (grouping its categories) the browser would scroll
           the page up to keep them in place, moving the switch under the finger -->
      <!-- Phone: the "+" of the tab bar opens the add sheet instead -->
      <CsvImport
        class="[overflow-anchor:none] max-md:hidden"
        :accounts="accounts"
        :categories="categories"
        @imported="refreshAfterAdd"
        @created="refreshAfterAdd"
        @error="setError"
      />

      <TransactionsTable
        class="min-w-0 [overflow-anchor:none] lg:col-span-2 xl:col-span-1 xl:min-h-[32rem] xl:flex-1"
        :class="onPhone('spending')"
        :accounts="accounts"
        :categories="categories"
        :version="dataVersion"
        :account="selected?._id"
        @changed="refresh"
        @error="setError"
      />
    </aside>

    <!-- Phone: steps aside, so the month's spending can lead its tab -->
    <div class="flex min-w-0 flex-col gap-6 max-md:contents lg:col-span-2 xl:col-span-1">
      <SpendInsights
        v-model="projectionMonth"
        :transactions="transactions"
        :projections="projections"
        :categories="categories"
        class="max-md:order-first"
        :class="onPhone('spending')"
        @open-budget="tab = 'budget'"
      />
      <ProjectionMonth
        v-model="budgetMonth"
        :class="onPhone('budget')"
        :projections="projections"
        :transactions="transactions"
        :categories="categories"
        @changed="refresh"
        @error="setError"
      />

      <!-- Phone only: from a tablet up, the balance is in the accounts' total
           card and the spending by category in the spending card -->
      <DashboardCharts
        class="md:hidden"
        :class="onPhone('analysis')"
        :transactions="transactions"
        :accounts="accounts"
        :categories="categories"
        :groups="categoryGroups"
      />
    </div>

    <!-- Opened after an addition that brought new pairs, or from a transaction's
         icon. Rendered on the body: no room taken in the grid. -->
    <MobileTabBar v-model="tab" :alerts="tabAlerts" @add="addOpen = true" />
    <MobileAddSheet
      v-model:open="addOpen"
      :accounts="accounts"
      :categories="categories"
      @imported="refreshAfterAdd"
      @created="refreshAfterAdd"
      @error="setError"
    />

    <TransferDialog @changed="refresh" @error="setError" />
    <DuplicateDialog @changed="refresh" @error="setError" />
  </div>
</template>
