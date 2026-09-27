<script setup>
import { computed, onMounted, ref } from 'vue';
import { api, formatCents } from './api.js';
import { ACCOUNT_TYPES, BANKS } from './lib/banks.js';
import AccountForm from './components/AccountForm.vue';
import CsvImport from './components/CsvImport.vue';
import TransactionForm from './components/TransactionForm.vue';

const accounts = ref([]);
const transactions = ref([]);
const error = ref('');

async function refresh() {
  try {
    const [a, t] = await Promise.all([api.getAccounts(), api.getTransactions()]);
    accounts.value = a;
    transactions.value = t;
    error.value = '';
  } catch (err) {
    error.value = err.message;
  }
}

onMounted(refresh);

const totalCents = computed(() => accounts.value.reduce((sum, a) => sum + a.balanceCents, 0));

async function deleteTransaction(id) {
  await api.deleteTransaction(id);
  refresh();
}
</script>

<template>
  <main>
    <h1>Mes finances</h1>
    <p v-if="error" class="error">{{ error }}</p>

    <section>
      <h2>Comptes — total {{ formatCents(totalCents) }}</h2>
      <ul>
        <li v-for="a in accounts" :key="a._id" class="flex items-center gap-2">
          <img
            v-if="BANKS[a.bank]"
            :src="BANKS[a.bank].logo"
            :alt="BANKS[a.bank].name"
            class="size-5 rounded"
          />
          <strong>{{ a.name }}</strong> ({{ ACCOUNT_TYPES[a.type] ?? a.type }}) :
          {{ formatCents(a.balanceCents, a.currency) }}
        </li>
      </ul>
      <AccountForm @created="refresh" @error="error = $event" />
    </section>

    <CsvImport :accounts="accounts" @imported="refresh" />

    <section>
      <h2>Transactions</h2>
      <TransactionForm
        v-if="accounts.length > 0"
        :accounts="accounts"
        @created="refresh"
        @error="error = $event"
      />
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Compte</th>
            <th>Description</th>
            <th>Montant</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in transactions" :key="t._id">
            <td>{{ new Date(t.date).toLocaleDateString('fr-CA') }}</td>
            <td>{{ t.account?.name }}</td>
            <td>{{ t.description }}</td>
            <td :class="t.amountCents < 0 ? 'negative' : 'positive'">
              {{ formatCents(t.amountCents) }}
            </td>
            <td>
              <button @click="deleteTransaction(t._id)">✕</button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </main>
</template>
