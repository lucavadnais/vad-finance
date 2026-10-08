<script setup lang="ts">
import type { Account, Category, ImportSummary, ParsedCsv } from '@/types';
import { ref } from 'vue';
import { ChevronRight, Upload } from '@lucide/vue';
import { api } from '@/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import AccountDialog from './AccountDialog.vue';
import ParseErrors from './ParseErrors.vue';
import TransactionForm from './TransactionForm.vue';

defineProps<{ accounts: Account[]; categories: Category[] }>();
// `imported` after a CSV import, `created` after a manual entry
const emit = defineEmits<{ imported: []; created: []; error: [message: string] }>();

const input = ref<HTMLInputElement | null>(null);
const dragging = ref(false);
const loading = ref(false);
const fileName = ref('');
const result = ref<ParsedCsv | null>(null);
const dialogOpen = ref(false);
const message = ref('');
const error = ref('');
const manualOpen = ref(false);

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

function onDone(account: Account, { inserted, skipped, linked }: ImportSummary) {
  reset();
  message.value =
    `${inserted} transaction(s) importée(s) dans « ${account.name} »` +
    (skipped > 0 ? `, ${skipped} doublon(s) non importé(s)` : '') +
    (linked > 0 ? `, ${linked} transfert(s) relié(s) à l'autre compte` : '');
  emit('imported');
}
</script>

<template>
  <!-- Phone: flat on the home page, under a line, and the drop zone becomes a
       button (no dragging files there) -->
  <Card
    class="max-md:gap-4 max-md:rounded-none max-md:border-x-0 max-md:border-b-0 max-md:bg-transparent max-md:pt-6 max-md:pb-0 max-md:shadow-none"
  >
    <CardHeader class="max-md:px-0">
      <CardTitle>Ajouter des transactions</CardTitle>
      <CardDescription class="max-md:hidden">
        Dépose le relevé CSV de ta banque : tu choisiras le compte et vérifieras les transactions avant de les importer.
      </CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col gap-4 max-md:px-0">
      <div
        role="button"
        tabindex="0"
        class="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-10 text-center transition-colors max-md:flex-row max-md:justify-center max-md:p-4"
        :class="dragging ? 'border-primary bg-muted' : 'border-border hover:bg-muted/50'"
        @click="input?.click()"
        @keydown.enter.space.prevent="input?.click()"
        @dragover.prevent="dragging = true"
        @dragleave="dragging = false"
        @drop.prevent="onDrop"
      >
        <Upload class="size-8 text-muted-foreground max-md:size-5" />
        <p class="font-medium">
          <template v-if="loading">Lecture en cours…</template>
          <template v-else-if="fileName">{{ fileName }}</template>
          <template v-else>
            <span class="md:hidden">Importer un relevé CSV</span>
            <span class="max-md:hidden">Glisse ton relevé CSV ici</span>
          </template>
        </p>
        <p v-if="!loading && !fileName" class="text-sm text-muted-foreground max-md:hidden">
          Banques supportées : CIBC & BNC
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
        :categories="categories"
        :result="result"
        @cancel="reset"
        @done="onDone"
      />

      <Separator />

      <!-- Secondary: one transaction at a time, folded by default -->
      <Collapsible v-model:open="manualOpen">
        <CollapsibleTrigger as-child>
          <Button variant="ghost" size="sm" class="-ml-2 text-muted-foreground">
            <ChevronRight class="transition-transform" :class="manualOpen && 'rotate-90'" />
            Saisir une transaction à la main
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent class="pt-3">
          <TransactionForm
            v-if="accounts.length > 0"
            :accounts="accounts"
            :categories="categories"
            @created="emit('created')"
            @error="emit('error', $event)"
          />
          <p v-else class="text-sm text-muted-foreground">Crée d'abord un compte dans la carte Comptes.</p>
        </CollapsibleContent>
      </Collapsible>
    </CardContent>
  </Card>
</template>
