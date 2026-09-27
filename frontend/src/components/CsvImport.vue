<script setup lang="ts">
import type { Account, ImportSummary, ParsedCsv } from '@/types';
import { ref } from 'vue';
import { Upload } from '@lucide/vue';
import { api } from '@/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import AccountDialog from './AccountDialog.vue';
import ParseErrors from './ParseErrors.vue';

defineProps<{ accounts: Account[] }>();
const emit = defineEmits<{ imported: [] }>();

const input = ref<HTMLInputElement | null>(null);
const dragging = ref(false);
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

function onDrop(e: DragEvent) {
  dragging.value = false;
  handleFile(e.dataTransfer?.files[0]);
}

function onChange(e: Event) {
  const target = e.target as HTMLInputElement;
  handleFile(target.files?.[0]);
  // Allow picking the same file again
  target.value = '';
}

function reset() {
  dialogOpen.value = false;
  result.value = null;
  fileName.value = '';
}

function onDone(account: Account, { inserted, skipped }: ImportSummary) {
  reset();
  message.value =
    `${inserted} transaction(s) importée(s) dans « ${account.name} »` +
    (skipped > 0 ? `, ${skipped} déjà présente(s) ignorée(s)` : '');
  emit('imported');
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>Importer un relevé CSV</CardTitle>
      <CardDescription>
        Le nom du fichier sert de nom de compte et indique la banque (CIBC, NBC).
      </CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col gap-3">
      <div
        role="button"
        tabindex="0"
        class="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-8 text-center text-sm transition-colors"
        :class="dragging ? 'border-primary bg-muted' : 'border-border hover:bg-muted/50'"
        @click="input?.click()"
        @keydown.enter.space.prevent="input?.click()"
        @dragover.prevent="dragging = true"
        @dragleave="dragging = false"
        @drop.prevent="onDrop"
      >
        <Upload class="size-6 text-muted-foreground" />
        <p>
          {{ loading ? 'Lecture en cours…' : fileName || 'Glisse un fichier CSV ici ou clique pour le choisir' }}
        </p>
        <input ref="input" type="file" accept=".csv,text/csv" hidden @change="onChange" />
      </div>

      <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
      <p v-if="message" class="text-sm text-emerald-600">{{ message }}</p>

      <!-- Nothing to import: explain why in the card, there is no popup -->
      <template v-if="result && result.transactions.length === 0">
        <p class="text-sm text-destructive">Aucune transaction trouvée dans ce fichier.</p>
        <ParseErrors :errors="result.errors" />
      </template>

      <AccountDialog
        v-if="dialogOpen && result"
        :accounts="accounts"
        :result="result"
        @cancel="reset"
        @done="onDone"
      />
    </CardContent>
  </Card>
</template>
