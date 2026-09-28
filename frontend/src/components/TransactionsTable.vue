<script setup lang="ts">
// Transactions, newest first, one page at a time (paginated by the backend)
import type { Account, Category, Transaction } from '@/types';
import { computed, ref, watch } from 'vue';
import { ChevronLeft, ChevronRight } from '@lucide/vue';
import { api } from '@/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  Table,
  TableBody,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import OptionSelect from './OptionSelect.vue';
import TransactionRow from './TransactionRow.vue';

const props = defineProps<{
  accounts: Account[];
  categories: Category[];
  // Bumped by the parent whenever transactions may have changed
  version: number;
}>();
const emit = defineEmits<{ changed: []; error: [message: string] }>();

const PAGE_SIZES = { '10': '10', '25': '25', '50': '50', '100': '100' };

const page = ref(1);
const pageSize = ref('25');
const items = ref<Transaction[]>([]);
const total = ref(0);
const loading = ref(false);

let requestId = 0;
// True while `page` is set from a response, so that change does not reload
let syncingPage = false;
async function load() {
  const id = ++requestId;
  loading.value = true;
  try {
    const result = await api.getTransactionsPage(page.value, Number(pageSize.value));
    if (id !== requestId) return; // a newer request is on its way
    items.value = result.items;
    total.value = result.total;
    // The backend returns the last page when asked for one past the end
    if (page.value !== result.page) {
      syncingPage = true;
      page.value = result.page;
    }
  } catch (err) {
    emit('error', (err as Error).message);
  } finally {
    if (id === requestId) loading.value = false;
  }
}

// The parent refreshes on mount, which bumps the version: no immediate load
watch(() => props.version, load);
watch(page, () => {
  if (syncingPage) syncingPage = false;
  else load();
});
watch(pageSize, () => {
  // Back to page 1: the page watcher reloads, unless already there
  if (page.value !== 1) page.value = 1;
  else load();
});

const range = computed(() => {
  if (total.value === 0) return '';
  const first = (page.value - 1) * Number(pageSize.value) + 1;
  const last = Math.min(page.value * Number(pageSize.value), total.value);
  return `${first}–${last} sur ${total.value}`;
});
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>Transactions</CardTitle>
      <CardDescription>{{ total }} transaction(s), les plus récentes en premier.</CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col gap-4">
      <!-- While the next page loads, the current one stays, dimmed -->
      <Table :class="loading && 'opacity-60 transition-opacity'">
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
            v-for="t in items"
            :key="t._id"
            :transaction="t"
            :accounts="accounts"
            :categories="categories"
            @changed="emit('changed')"
            @error="emit('error', $event)"
          />
          <TableEmpty v-if="items.length === 0 && !loading" :colspan="6">Aucune transaction</TableEmpty>
        </TableBody>
      </Table>

      <div v-if="total > 0" class="flex flex-wrap items-center gap-4">
        <div class="flex items-center gap-2 text-sm text-muted-foreground">
          Lignes par page
          <OptionSelect v-model="pageSize" :options="PAGE_SIZES" class="h-8 w-20" />
        </div>
        <span class="text-sm text-muted-foreground tabular-nums">{{ range }}</span>
        <Pagination
          v-slot="{ page: current }"
          v-model:page="page"
          :items-per-page="Number(pageSize)"
          :total="total"
          :sibling-count="1"
          show-edges
          class="ml-auto w-auto"
        >
          <PaginationContent v-slot="{ items: pages }">
            <PaginationPrevious>
              <ChevronLeft />
              <span class="hidden sm:block">Précédent</span>
            </PaginationPrevious>
            <template v-for="(item, index) in pages" :key="index">
              <PaginationItem v-if="item.type === 'page'" :value="item.value" :is-active="item.value === current">
                {{ item.value }}
              </PaginationItem>
              <PaginationEllipsis v-else :index="index" />
            </template>
            <PaginationNext>
              <span class="hidden sm:block">Suivant</span>
              <ChevronRight />
            </PaginationNext>
          </PaginationContent>
        </Pagination>
      </div>
    </CardContent>
  </Card>
</template>
