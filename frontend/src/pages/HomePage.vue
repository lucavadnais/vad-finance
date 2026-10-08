<script setup lang="ts">
import type { Month } from '@/lib/projections';
import { computed, defineAsyncComponent, ref, watch } from 'vue';
import { Pencil } from '@lucide/vue';
import { formatCents } from '@/api';
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
import DuplicateDialog from '@/components/DuplicateDialog.vue';
import ProjectionMonth from '@/components/ProjectionMonth.vue';
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

const totalCents = computed(() => accounts.value.reduce((sum, a) => sum + a.balanceCents, 0));

// Month shown by the budget card (its forecasts chart picks it too)
const projectionMonth = ref<Month>(currentMonth());
</script>

<template>
  <!-- Mobile: one column. Tablet: accounts and import side by side, transactions
       below them. Desktop: the three become a sidebar next to forecasts and charts -->
  <div class="grid gap-6 md:grid-cols-2 xl:grid-cols-[minmax(32rem,2fr)_3fr]">
    <!-- Desktop: [contain:size] keeps the sidebar out of the row height, so it
         stretches to the forecasts and charts column, and the transactions fill
         what is left (scrolling inside) instead of pushing the page longer -->
    <aside class="contents xl:flex xl:flex-col xl:gap-6 xl:[contain:size]">
      <!-- The total of the accounts is the page's headline figure: the biggest
           number, above the budget's net, on the night surface -->
      <Card class="surface-night">
        <CardHeader>
          <CardDescription>Total des comptes</CardDescription>
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
              <span class="font-medium">{{ a.name }}</span>
              <span class="text-muted-foreground">({{ ACCOUNT_TYPES[a.type] ?? a.type }})</span>
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

      <!-- Import and transactions keep their place after the charts on mobile -->
      <CsvImport
        class="order-1 md:order-none"
        :accounts="accounts"
        :categories="categories"
        @imported="refreshAfterAdd"
        @created="refreshAfterAdd"
        @error="setError"
      />

      <TransactionsTable
        class="order-1 min-w-0 md:order-none md:col-span-2 xl:col-span-1 xl:min-h-80 xl:flex-1"
        :accounts="accounts"
        :categories="categories"
        :version="dataVersion"
        @changed="refresh"
        @error="setError"
      />
    </aside>

    <div class="flex min-w-0 flex-col gap-6 md:col-span-2 xl:col-span-1">
      <ProjectionMonth
        v-model="projectionMonth"
        :projections="projections"
        :transactions="transactions"
        :categories="categories"
        @changed="refresh"
        @error="setError"
      />

      <DashboardCharts
        :transactions="transactions"
        :accounts="accounts"
        :categories="categories"
        :groups="categoryGroups"
      />
    </div>

    <!-- Opened after an addition that brought new pairs, or from a transaction's
         icon. Rendered on the body: no room taken in the grid. -->
    <TransferDialog @changed="refresh" @error="setError" />
    <DuplicateDialog @changed="refresh" @error="setError" />
  </div>
</template>
