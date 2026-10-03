<script setup lang="ts">
import type { Month } from '@/lib/projections';
import { computed, defineAsyncComponent, ref } from 'vue';
import { Pencil } from '@lucide/vue';
import { formatCents } from '@/api';
import { useFinanceData } from '@/composables/useFinanceData';
import { ACCOUNT_TYPES } from '@/lib/labels';
import { currentMonth } from '@/lib/projections';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AccountForm from '@/components/AccountForm.vue';
import AccountLogo from '@/components/AccountLogo.vue';
import CsvImport from '@/components/CsvImport.vue';
import DuplicateReview from '@/components/DuplicateReview.vue';
import ProjectionMonth from '@/components/ProjectionMonth.vue';
import TransactionsTable from '@/components/TransactionsTable.vue';
import TransferSuggestions from '@/components/TransferSuggestions.vue';

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
      <Card>
        <CardHeader>
          <CardTitle>Comptes — total {{ formatCents(totalCents) }}</CardTitle>
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
        @imported="refresh"
        @created="refresh"
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

    <div class="order-2 flex min-w-0 flex-col gap-6 md:order-none md:col-span-2">
      <!-- Shown when an import (or a manual entry) produced both sides of a transfer -->
      <TransferSuggestions
        v-if="transferCandidates.length > 0"
        :candidates="transferCandidates"
        @changed="refresh"
        @error="setError"
      />

      <DuplicateReview v-if="duplicatePairs.length > 0" :pairs="duplicatePairs" @changed="refresh" @error="setError" />
    </div>
  </div>
</template>
