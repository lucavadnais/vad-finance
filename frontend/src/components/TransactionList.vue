<script setup lang="ts">
// Transactions as the app lists them (TransactionRow: account image, date,
// description, category, amount, its actions menu), with one edit popup for
// them all. On an account's page, in the unplanned spending dialog and beside
// the budget chart for the buffer.
import type { Transaction } from '@/types';
import { ref } from 'vue';
import { useFinanceData } from '@/composables/useFinanceData';
import { Table, TableBody, TableEmpty } from '@/components/ui/table';
import TransactionEditDialog from './TransactionEditDialog.vue';
import TransactionRow from './TransactionRow.vue';

// hideAccount: one account's transactions, its logo on each row says nothing.
// readonly: for reference, no actions menu (nor edit popup)
const props = withDefaults(
  defineProps<{ transactions: Transaction[]; hideAccount?: boolean; readonly?: boolean; empty?: string }>(),
  { empty: 'Aucune transaction' },
);
const columns = () => 5 - (props.hideAccount ? 1 : 0) - (props.readonly ? 1 : 0);

const { accounts, categories, refresh, setError } = useFinanceData();

const editing = ref<Transaction | null>(null);
const editOpen = ref(false);
function edit(t: Transaction) {
  editing.value = t;
  editOpen.value = true;
}
</script>

<template>
  <!-- Narrow (a phone, a side column): the category goes under the description -->
  <div class="@container">
    <Table>
      <TableBody>
        <TransactionRow
          v-for="t in transactions"
          :key="t._id"
          :transaction="t"
          :hide-account="hideAccount"
          :readonly="readonly"
          @edit="edit(t)"
          @changed="refresh"
          @error="setError"
        />
        <TableEmpty v-if="transactions.length === 0" :colspan="columns()">{{ empty }}</TableEmpty>
      </TableBody>
    </Table>
  </div>
  <TransactionEditDialog
    v-if="!readonly"
    v-model:open="editOpen"
    :transaction="editing"
    :accounts="accounts"
    :categories="categories"
    @changed="refresh"
  />
</template>
