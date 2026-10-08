// The dialog reviewing suggested transfers (TransferDialog, mounted once on the
// home page): opened after an addition brings new pairs, or from the icon next
// to the transactions card's title
import type { TransferCandidate } from '@/types';
import { computed, ref } from 'vue';
import { useFinanceData } from './useFinanceData';

const open = ref(false);
// Pairs shown, by the id of their outgoing side: the dialog reads them from the
// current suggestions, so a linked or dismissed pair leaves it
const keys = ref<string[]>([]);

const { transferCandidates } = useFinanceData();

const shown = computed(() => transferCandidates.value.filter((c) => keys.value.includes(c.out._id)));

function review(candidates: TransferCandidate[]) {
  if (candidates.length === 0) return;
  keys.value = candidates.map((c) => c.out._id);
  open.value = true;
}

export function useTransferReview() {
  return { open, shown, review };
}
