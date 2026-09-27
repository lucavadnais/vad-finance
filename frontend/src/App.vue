<script setup lang="ts">
import type { Account, Category, Transaction } from '@/types';
import { computed, onMounted, ref } from 'vue';
import { api, formatCents } from '@/api';
import { BANKS } from '@/lib/banks';
import { ACCOUNT_TYPES } from '@/lib/labels';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import AccountForm from './components/AccountForm.vue';
import CategoryManager from './components/CategoryManager.vue';
import CsvImport from './components/CsvImport.vue';
import TransactionForm from './components/TransactionForm.vue';
import TransactionRow from './components/TransactionRow.vue';

const accounts = ref<Account[]>([]);
const categories = ref<Category[]>([]);
const transactions = ref<Transaction[]>([]);
const error = ref('');

async function refresh() {
  try {
    const [a, c, t] = await Promise.all([
      api.getAccounts(),
      api.getCategories(),
      api.getTransactions(),
    ]);
    accounts.value = a;
    categories.value = c;
    transactions.value = t;
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
            <img
              v-if="a.bank && BANKS[a.bank]"
              :src="BANKS[a.bank].logo"
              :alt="BANKS[a.bank].name"
              class="size-5 rounded"
            />
            <span class="font-medium">{{ a.name }}</span>
            <span class="text-muted-foreground">({{ ACCOUNT_TYPES[a.type] ?? a.type }})</span>
            <span class="ml-auto tabular-nums">{{ formatCents(a.balanceCents, a.currency) }}</span>
          </li>
        </ul>
        <AccountForm @created="refresh" @error="setError" />
      </CardContent>
    </Card>

    <CategoryManager :categories="categories" @changed="refresh" @error="setError" />

    <CsvImport :accounts="accounts" @imported="refresh" />

    <Card>
      <CardHeader>
        <CardTitle>Transactions</CardTitle>
      </CardHeader>
      <CardContent class="flex flex-col gap-4">
        <TransactionForm
          v-if="accounts.length > 0"
          :accounts="accounts"
          :categories="categories"
          @created="refresh"
          @error="setError"
        />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Compte</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead class="text-right">Montant</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            <TransactionRow
              v-for="t in transactions"
              :key="t._id"
              :transaction="t"
              :accounts="accounts"
              :categories="categories"
              @changed="refresh"
              @error="setError"
            />
            <TableEmpty v-if="transactions.length === 0" :colspan="6">Aucune transaction</TableEmpty>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  </main>
</template>
