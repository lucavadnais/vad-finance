// The dialog reviewing possible duplicates (DuplicateDialog, mounted once on the
// home page): opened after an addition brings new pairs, or from the icon next
// to the transactions card's title
import type { DuplicatePair } from '@/types';
import { computed, ref } from 'vue';
import { useFinanceData } from './useFinanceData';

export const duplicateKey = (p: DuplicatePair) => `${p.a._id}-${p.b._id}`;

const open = ref(false);
// Transactions under review (null: all the pairs). The dialog shows the current
// pairs involving them: a resolved pair leaves it, and the pair that shows up
// once one side is gone (each transaction is in one pair at most, so a third
// look-alike waits its turn) comes in.
const ids = ref<Set<string> | null>(null);

const { duplicatePairs } = useFinanceData();

const shown = computed(() => {
  const under = ids.value;
  return under ? duplicatePairs.value.filter((p) => under.has(p.a._id) || under.has(p.b._id)) : duplicatePairs.value;
});

function review(pairs: DuplicatePair[]) {
  if (pairs.length === 0) return;
  ids.value = new Set(pairs.flatMap((p) => [p.a._id, p.b._id]));
  open.value = true;
}

function reviewAll() {
  ids.value = null;
  open.value = true;
}

export function useDuplicateReview() {
  return { open, shown, review, reviewAll };
}
