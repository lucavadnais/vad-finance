<script setup lang="ts">
import type {
  Account,
  Category,
  CategoryGroup,
  DuplicatePair,
  Transaction,
  TransferCandidate,
} from '@/types';
import { computed, defineAsyncComponent, onMounted, ref } from 'vue';
import { api, formatCents } from '@/api';
import { ACCOUNT_TYPES } from '@/lib/labels';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AccountForm from './components/AccountForm.vue';
import AccountLogoButton from './components/AccountLogoButton.vue';
import CategoryManager from './components/CategoryManager.vue';
import CsvImport from './components/CsvImport.vue';
import TransactionsTable from './components/TransactionsTable.vue';
import TransferSuggestions from './components/TransferSuggestions.vue';
import DuplicateReview from './components/DuplicateReview.vue';

// Charts pull in Unovis (~1 MB): load them in their own chunk
const DashboardCharts = defineAsyncComponent(() => import('./components/charts/DashboardCharts.vue'));

const accounts = ref<Account[]>([]);
const categories = ref<Category[]>([]);
const categoryGroups = ref<CategoryGroup[]>([]);
// Every transaction, for the charts; the table loads its own pages
const transactions = ref<Transaction[]>([]);
// Bumped on each refresh so the table reloads its page
const dataVersion = ref(0);
const transferCandidates = ref<TransferCandidate[]>([]);
const duplicatePairs = ref<DuplicatePair[]>([]);
const error = ref('');

async function refresh() {
  try {
    const [a, c, g, t, tc, d] = await Promise.all([
      api.getAccounts(),
      api.getCategories(),
      api.getCategoryGroups(),
      api.getTransactions(),
      api.getTransferCandidates(),
      api.getDuplicates(),
    ]);
    accounts.value = a;
    categories.value = c;
    categoryGroups.value = g;
    transactions.value = t;
    dataVersion.value++;
    transferCandidates.value = tc;
    duplicatePairs.value = d;
    error.value = '';
  } catch (err) {
    error.value = (err as Error).message;
  }
}

onMounted(refresh);

const totalCents = computed(() => accounts.value.reduce((sum, a) => sum + a.balanceCents, 0));

function setError(message: string) {
  error.value = message;
}
</script>

<template>
  <main class="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
    <h1 class="text-3xl font-semibold">Mes finances</h1>
    <p v-if="error" class="text-sm text-destructive">{{ error }}</p>

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

    <CategoryManager
      :categories="categories"
      :groups="categoryGroups"
      @changed="refresh"
      @error="setError"
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
  </main>
</template>
