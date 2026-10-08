// "Hide amounts" (the eye next to the accounts total): formatCents and
// formatCentsCompact then show a mask instead of the number, everywhere.
// Remembered in this browser only.
import { ref, watch } from 'vue';

const KEY = 'amountsHidden';

function load() {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export const amountsHidden = ref(load());

watch(amountsHidden, (hidden) => {
  try {
    localStorage.setItem(KEY, hidden ? '1' : '0');
  } catch {
    // Storage blocked (private window): the choice lasts until reload
  }
});

export function useAmountsHidden() {
  return { amountsHidden, toggle: () => (amountsHidden.value = !amountsHidden.value) };
}
