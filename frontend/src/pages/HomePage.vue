<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue';
import { formatCents } from '@/api';
import { useFinanceData } from '@/composables/useFinanceData';
import { ACCOUNT_TYPES } from '@/lib/labels';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AccountForm from '@/components/AccountForm.vue';
import AccountLogoButton from '@/components/AccountLogoButton.vue';
import CsvImport from '@/components/CsvImport.vue';
import DuplicateReview from '@/components/DuplicateReview.vue';
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
  refresh,
  setError,
} = useFinanceData();

const totalCents = computed(() => accounts.value.reduce((sum, a) => sum + a.balanceCents, 0));
</script>

<template>
  <div class="flex flex-col gap-6">
    <Card>
      <CardHeader>
        <CardTitle>Comptes — total {{ formatCents(totalCents) }}</CardTitle>
      </CardHeader>
      <CardContent class="flex flex-col gap-4">
        <ul class="flex flex-col gap-2">
          <li v-for="a in accounts" :key="a._id" class="flex items-center gap-2 text-sm">
            <AccountLogoButton :account="a" @changed="refresh" @error="setError" />
            <span class="font-medium">{{ a.name }}</span>
            <span class="text-muted-foreground">({{ ACCOUNT_TYPES[a.type] ?? a.type }})</span>
            <span class="ml-auto tabular-nums">{{ formatCents(a.balanceCents, a.currency) }}</span>
          </li>
        </ul>
        <AccountForm @created="refresh" @error="setError" />
      </CardContent>
    </Card>

    <DashboardCharts
      :transactions="transactions"
      :accounts="accounts"
      :categories="categories"
      :groups="categoryGroups"
    />

    <CsvImport
      :accounts="accounts"
      :categories="categories"
      @imported="refresh"
      @created="refresh"
      @error="setError"
    />

    <!-- Shown when an import (or a manual entry) produced both sides of a transfer -->
    <TransferSuggestions
      v-if="transferCandidates.length > 0"
      :candidates="transferCandidates"
      @changed="refresh"
      @error="setError"
    />

    <DuplicateReview
      v-if="duplicatePairs.length > 0"
      :pairs="duplicatePairs"
      @changed="refresh"
      @error="setError"
    />

    <TransactionsTable
      :accounts="accounts"
      :categories="categories"
      :version="dataVersion"
      @changed="refresh"
      @error="setError"
    />
  </div>
</template>
