<script setup lang="ts">
// Transactions, newest first, one page at a time (paginated and searched by the backend).
// Next to the title, an icon per kind of pending review (transfers to link,
// possible duplicates) opens its dialog.
import type { Account, Category, Transaction } from '@/types';
import { computed, onMounted, ref, watch } from 'vue';
import { ChevronLeft, ChevronRight, Copy, Search, TriangleAlert, X } from '@lucide/vue';
import { refDebounced, useMediaQuery } from '@vueuse/core';
import { api } from '@/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Table, TableBody, TableEmpty, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useDuplicateReview } from '@/composables/useDuplicateReview';
import { useFinanceData } from '@/composables/useFinanceData';
import { useTransferReview } from '@/composables/useTransferReview';
import OptionSelect from './OptionSelect.vue';
import TransactionEditDialog from './TransactionEditDialog.vue';
import TransactionRow from './TransactionRow.vue';

// On a phone, fewer page numbers so the pagination fits
const wide = useMediaQuery('(min-width: 640px)');

const props = defineProps<{
  accounts: Account[];
  categories: Category[];
  // Bumped by the parent whenever transactions may have changed
  version: number;
}>();
const emit = defineEmits<{ changed: []; error: [message: string] }>();

const { transferCandidates, duplicatePairs } = useFinanceData();
const { review: reviewTransfers } = useTransferReview();
const { reviewAll: reviewDuplicates } = useDuplicateReview();
const plural = (n: number) => (n > 1 ? 's' : '');
const transfersLabel = computed(
  () => `${transferCandidates.value.length} transfert${plural(transferCandidates.value.length)} à lier`,
);
const duplicatesLabel = computed(() => {
  const n = duplicatePairs.value.length;
  return `${n} doublon${plural(n)} possible${plural(n)}`;
});

const PAGE_SIZES = { '10': '10', '25': '25', '50': '50', '100': '100' };

const page = ref(1);
const pageSize = ref('25');
const items = ref<Transaction[]>([]);
const total = ref(0);
const loading = ref(false);
// Searched on the server, a moment after the user stops typing
const search = ref('');
const query = refDebounced(
  computed(() => search.value.trim()),
  300,
);

let requestId = 0;
// True while `page` is set from a response, so that change does not reload
let syncingPage = false;
async function load() {
  const id = ++requestId;
  loading.value = true;
  try {
    const result = await api.getTransactionsPage(page.value, Number(pageSize.value), query.value);
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

// On app start, the first refresh bumps the version, which loads the page.
// Back on this page later, the data is already there: load right away.
onMounted(() => {
  if (props.version > 0) load();
});
watch(() => props.version, load);
watch(page, () => {
  if (syncingPage) syncingPage = false;
  else load();
});
watch([pageSize, query], () => {
  // Back to page 1: the page watcher reloads, unless already there
  if (page.value !== 1) page.value = 1;
  else load();
});

// One edit popup for the whole table
const editing = ref<Transaction | null>(null);
const editOpen = ref(false);
function edit(t: Transaction) {
  editing.value = t;
  editOpen.value = true;
}

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
      <CardTitle class="flex min-h-8 items-center gap-1">
        Transactions
        <Button
          v-if="transferCandidates.length > 0"
          size="sm"
          variant="ghost"
          class="ml-1 text-amber-600 hover:text-amber-600"
          :title="transfersLabel"
          @click="reviewTransfers(transferCandidates)"
        >
          <TriangleAlert />
          <span class="tabular-nums">{{ transferCandidates.length }}</span>
          <span class="sr-only">{{ transfersLabel }}</span>
        </Button>
        <Button
          v-if="duplicatePairs.length > 0"
          size="sm"
          variant="ghost"
          class="text-amber-600 hover:text-amber-600"
          :title="duplicatesLabel"
          @click="reviewDuplicates()"
        >
          <Copy />
          <span class="tabular-nums">{{ duplicatePairs.length }}</span>
          <span class="sr-only">{{ duplicatesLabel }}</span>
        </Button>
      </CardTitle>
      <CardDescription>
        <template v-if="query">{{ total }} résultat(s) pour « {{ query }} ».</template>
        <template v-else>{{ total }} transaction(s), les plus récentes en premier.</template>
      </CardDescription>
      <div class="relative mt-2">
        <Search class="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          v-model="search"
          type="search"
          placeholder="Description, compte, catégorie, montant…"
          aria-label="Rechercher une transaction"
          class="pr-8 pl-8 [&::-webkit-search-cancel-button]:hidden"
          @keydown.esc="search = ''"
        />
        <Button
          v-if="search"
          variant="ghost"
          size="icon-xs"
          class="absolute top-1/2 right-1.5 -translate-y-1/2"
          aria-label="Effacer la recherche"
          @click="search = ''"
        >
          <X />
        </Button>
      </div>
    </CardHeader>
    <!-- When the parent caps the card's height, the rows scroll under a sticky
         header and the pagination stays visible -->
    <CardContent class="@container flex min-h-0 flex-1 flex-col gap-4">
      <div
        class="flex min-h-0 flex-1 flex-col *:data-[slot=table-container]:min-h-0 *:data-[slot=table-container]:flex-1"
      >
        <!-- While the next page loads, the current one stays, dimmed -->
        <Table :class="loading && 'opacity-60 transition-opacity'">
          <TableHeader class="sticky top-0 z-10 bg-card">
            <TableRow>
              <TableHead class="w-px pr-0"><span class="sr-only">Compte</span></TableHead>
              <TableHead>Transaction</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead class="text-right">Montant</TableHead>
              <TableHead class="w-px"><span class="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TransactionRow
              v-for="t in items"
              :key="t._id"
              :transaction="t"
              @edit="edit(t)"
              @changed="emit('changed')"
              @error="emit('error', $event)"
            />
            <TableEmpty v-if="items.length === 0 && !loading" :colspan="5">
              {{ query ? 'Aucune transaction ne correspond à la recherche' : 'Aucune transaction' }}
            </TableEmpty>
          </TableBody>
        </Table>
      </div>

      <TransactionEditDialog
        v-model:open="editOpen"
        :transaction="editing"
        :accounts="accounts"
        :categories="categories"
        @changed="emit('changed')"
      />

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
          :sibling-count="wide ? 1 : 0"
          show-edges
          class="ml-auto w-auto"
        >
          <PaginationContent v-slot="{ items: pages }">
            <PaginationPrevious>
              <ChevronLeft />
              <span class="hidden @lg:block">Précédent</span>
            </PaginationPrevious>
            <template v-for="(item, index) in pages" :key="index">
              <PaginationItem v-if="item.type === 'page'" :value="item.value" :is-active="item.value === current">
                {{ item.value }}
              </PaginationItem>
              <PaginationEllipsis v-else :index="index" />
            </template>
            <PaginationNext>
              <span class="hidden @lg:block">Suivant</span>
              <ChevronRight />
            </PaginationNext>
          </PaginationContent>
        </Pagination>
      </div>
    </CardContent>
  </Card>
</template>
