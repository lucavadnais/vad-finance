<script setup lang="ts">
import type { Month } from '@/lib/projections';
import { computed, defineAsyncComponent, ref, useTemplateRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Eye, EyeOff, Pencil } from '@lucide/vue';
import { formatCents } from '@/api';
import { useAmountsHidden } from '@/composables/useAmountsHidden';
import { useFinanceData } from '@/composables/useFinanceData';
import { duplicateKey, useDuplicateReview } from '@/composables/useDuplicateReview';
import { useTransferReview } from '@/composables/useTransferReview';
import { ACCOUNT_TYPES } from '@/lib/labels';
import { currentMonth } from '@/lib/projections';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import AccountForm from '@/components/AccountForm.vue';
import AccountLogo from '@/components/AccountLogo.vue';
import CsvImport from '@/components/CsvImport.vue';
import MobileTabBar, { type HomeTab } from '@/components/MobileTabBar.vue';
import DuplicateDialog from '@/components/DuplicateDialog.vue';
import MobileHome from '@/components/MobileHome.vue';
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

const totalCents = computed(() => accounts.value.reduce((sum, a) => sum + a.balanceCents, 0));

// Month shown by the month card and the budget card (its forecasts chart
// picks it too)
const projectionMonth = ref<Month>(currentMonth());
// Forecasts open in the budget card's dialog, from the month card's tiles too
const budgetCard = useTemplateRef('budgetCard');

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
const tabAlerts = computed(() => ({
  spending: transferCandidates.value.length > 0 || duplicatePairs.value.length > 0,
}));
</script>

<template>
  <!-- Mobile: one column. Tablet: accounts and import side by side, transactions
       below them. Desktop: the three become a sidebar next to forecasts and charts -->
  <!-- Phone: room at the bottom for the tab bar -->
  <div class="grid grid-cols-1 gap-6 max-md:pb-24 md:grid-cols-2 xl:grid-cols-[minmax(32rem,2fr)_3fr]">
    <!-- Desktop: [contain:size] keeps the sidebar out of the row height, so it
         stretches to the forecasts and charts column, and the transactions fill
         what is left (scrolling inside) instead of pushing the page longer -->
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
           number, above the budget's net, on the night surface -->
      <!-- Phone: taken apart in the home tab (MobileHome) -->
      <Card class="surface-night max-md:hidden">
        <CardHeader>
          <CardDescription class="flex items-center gap-1">
            Total des comptes
            <Button
              size="icon-xs"
              variant="ghost"
              :aria-label="amountsHidden ? 'Afficher les montants' : 'Masquer les montants'"
              :title="amountsHidden ? 'Afficher les montants' : 'Masquer les montants'"
              :aria-pressed="amountsHidden"
              @click="toggleAmounts"
            >
              <EyeOff v-if="amountsHidden" />
              <Eye v-else />
            </Button>
          </CardDescription>
          <CardTitle class="text-4xl font-semibold tabular-nums" :class="totalCents < 0 && 'text-destructive'">
            {{ formatCents(totalCents) }}
          </CardTitle>
          <CardAction>
            <AccountForm @created="refresh" @error="setError" />
          </CardAction>
        </CardHeader>
        <CardContent>
          <p v-if="accounts.length === 0" class="text-sm text-muted-foreground">Aucun compte pour l'instant.</p>
          <ul v-else class="flex flex-col gap-2">
            <li v-for="a in accounts" :key="a._id" class="flex items-center gap-2 text-sm">
              <AccountLogo :account="a" />
              <!-- On mobile, the type wraps under the name rather than squeezing it -->
              <span class="flex min-w-0 flex-wrap gap-x-2">
                <span class="font-medium">{{ a.name }}</span>
                <span class="text-muted-foreground">({{ ACCOUNT_TYPES[a.type] ?? a.type }})</span>
              </span>
              <span class="ml-auto tabular-nums">{{ formatCents(a.balanceCents, a.currency) }}</span>
              <AccountForm :account="a" :accounts="accounts" @changed="refresh" @error="setError">
                <Button size="icon-sm" variant="ghost" :aria-label="`Modifier ${a.name}`" :title="`Modifier ${a.name}`">
                  <Pencil />
                </Button>
              </AccountForm>
            </li>
          </ul>
        </CardContent>
      </Card>

      <!-- Not scroll anchors (both): on a phone they follow the month card, and
           when it gets shorter (grouping its categories) the browser would scroll
           the page up to keep them in place, moving the switch under the finger -->
      <CsvImport
        class="[overflow-anchor:none]"
        :class="onPhone('spending')"
        :accounts="accounts"
        :categories="categories"
        @imported="refreshAfterAdd"
        @created="refreshAfterAdd"
        @error="setError"
      />

      <TransactionsTable
        class="min-w-0 [overflow-anchor:none] md:col-span-2 xl:col-span-1 xl:min-h-80 xl:flex-1"
        :class="onPhone('spending')"
        :accounts="accounts"
        :categories="categories"
        :version="dataVersion"
        @changed="refresh"
        @error="setError"
      />
    </aside>

    <!-- Phone: steps aside, so the month's spending can lead its tab -->
    <div class="flex min-w-0 flex-col gap-6 max-md:contents md:col-span-2 xl:col-span-1">
      <SpendInsights
        v-model="projectionMonth"
        :transactions="transactions"
        :projections="projections"
        :categories="categories"
        class="max-md:order-first"
        :class="onPhone('spending')"
        @edit="budgetCard?.openDialog($event)"
      />
      <ProjectionMonth
        ref="budgetCard"
        v-model="projectionMonth"
        :class="onPhone('budget')"
        :projections="projections"
        :transactions="transactions"
        :categories="categories"
        @changed="refresh"
        @error="setError"
      />

      <DashboardCharts
        :class="onPhone('analysis')"
        :transactions="transactions"
        :accounts="accounts"
        :categories="categories"
        :groups="categoryGroups"
      />
    </div>

    <!-- Opened after an addition that brought new pairs, or from a transaction's
         icon. Rendered on the body: no room taken in the grid. -->
    <MobileTabBar v-model="tab" :alerts="tabAlerts" />

    <TransferDialog @changed="refresh" @error="setError" />
    <DuplicateDialog @changed="refresh" @error="setError" />
  </div>
</template>
