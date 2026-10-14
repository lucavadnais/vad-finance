// Importing a bank statement (CSV): the file read by the backend, then its
// preview (AccountDialog, rendered by the caller with `result` while
// `dialogOpen`), then a sentence saying what was imported. Shared by the
// import card (tablet, computer) and the phone's add sheet.
import type { Account, ImportSummary, ParsedCsv } from '@/types';
import { ref } from 'vue';
import { api } from '@/api';

// `onImported`: once transactions went in (the caller refreshes the data)
export function useCsvImport(onImported: () => void) {
  const loading = ref(false);
  const fileName = ref('');
  const result = ref<ParsedCsv | null>(null);
  const dialogOpen = ref(false);
  const message = ref('');
  const error = ref('');

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      error.value = 'Le fichier doit être un .csv';
      return;
    }
    fileName.value = file.name;
    loading.value = true;
    error.value = '';
    message.value = '';
    result.value = null;
    try {
      const parsed = await api.parseTransactionsCsv(file);
      result.value = parsed;
      if (parsed.transactions.length > 0) dialogOpen.value = true;
    } catch (err) {
      error.value = (err as Error).message;
    } finally {
      loading.value = false;
    }
  }

  // From a file input's change: the same file can then be picked again
  function onInputChange(e: Event) {
    const target = e.target as HTMLInputElement;
    handleFile(target.files?.[0]);
    target.value = '';
  }

  function reset() {
    dialogOpen.value = false;
    result.value = null;
    fileName.value = '';
  }

  // The preview's `done`: `warning` when something after the import failed
  function onDone(account: Account, { inserted, skipped, linked }: ImportSummary, warning?: string) {
    reset();
    error.value = warning ?? '';
    message.value =
      `${inserted} transaction(s) importée(s) dans « ${account.name} »` +
      (skipped > 0 ? `, ${skipped} doublon(s) non importé(s)` : '') +
      (linked > 0 ? `, ${linked} transfert(s) relié(s) à l'autre compte` : '');
    onImported();
  }

  return { loading, fileName, result, dialogOpen, message, error, handleFile, onInputChange, reset, onDone };
}
