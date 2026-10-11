// The account picked in the accounts' total card on a computer: 'all', or one
// account's id. That card, the spending card and the transactions then show
// only it. A phone picks none (its accounts open their own page), so there it
// is always 'all'.
import { computed, ref } from 'vue';
import { useMediaQuery } from '@vueuse/core';

const picked = ref<string>('all');
const computer = useMediaQuery('(min-width: 768px)');
const account = computed({
  get: () => (computer.value ? picked.value : 'all'),
  set: (id: string) => (picked.value = id),
});

export function useSelectedAccount() {
  return account;
}
