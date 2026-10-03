// App-wide data, shared by every page: loaded once, refreshed after each change
import type {
  Account,
  Category,
  CategoryGroup,
  DuplicatePair,
  Projection,
  Transaction,
  TransferCandidate,
} from '@/types';
import { computed, ref } from 'vue';
import { api } from '@/api';
import { categoryColors as colorsOf } from '@/lib/colors';

const accounts = ref<Account[]>([]);
const categories = ref<Category[]>([]);
const categoryGroups = ref<CategoryGroup[]>([]);
// Every transaction, for the charts; the transactions table loads its own pages
const transactions = ref<Transaction[]>([]);
// Bumped on each refresh so the transactions table reloads its page
const dataVersion = ref(0);
const projections = ref<Projection[]>([]);
const transferCandidates = ref<TransferCandidate[]>([]);
const duplicatePairs = ref<DuplicatePair[]>([]);
const error = ref('');
// Displayed color of each category, by id (group shade or own color)
const categoryColors = computed(() => colorsOf(categories.value, categoryGroups.value));

async function refresh() {
  try {
    const [a, c, g, t, tc, d, p] = await Promise.all([
      api.getAccounts(),
      api.getCategories(),
      api.getCategoryGroups(),
      api.getTransactions(),
      api.getTransferCandidates(),
      api.getDuplicates(),
      api.getProjections(),
    ]);
    accounts.value = a;
    categories.value = c;
    categoryGroups.value = g;
    transactions.value = t;
    dataVersion.value++;
    transferCandidates.value = tc;
    duplicatePairs.value = d;
    projections.value = p;
    error.value = '';
  } catch (err) {
    error.value = (err as Error).message;
  }
}

function setError(message: string) {
  error.value = message;
}

export function useFinanceData() {
  return {
    accounts,
    categories,
    categoryGroups,
    categoryColors,
    transactions,
    dataVersion,
    transferCandidates,
    duplicatePairs,
    projections,
    error,
    refresh,
    setError,
  };
}
