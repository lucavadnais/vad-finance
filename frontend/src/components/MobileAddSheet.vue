<script setup lang="ts">
import type { Account, Category } from '@/types';
import { ref, watch } from 'vue';
import { ChevronLeft, ChevronRight, PencilLine, Upload } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { useCsvImport } from '@/composables/useCsvImport';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import AccountDialog from './AccountDialog.vue';
import ParseErrors from './ParseErrors.vue';
import TransactionForm from './TransactionForm.vue';

const open = defineModel<boolean>('open', { required: true });
defineProps<{ accounts: Account[]; categories: Category[] }>();
const emit = defineEmits<{ imported: []; created: []; error: [message: string] }>();

const { loading, result, dialogOpen, message, error, onInputChange, reset, onDone } = useCsvImport(() =>
  emit('imported'),
);

const input = ref<HTMLInputElement | null>(null);
const manual = ref(false);
const added = ref('');

function showManual(on: boolean) {
  manual.value = on;
  added.value = '';
}

watch(open, (o) => {
  if (!o) return;
  manual.value = false;
  message.value = '';
  error.value = '';
  added.value = '';
});

function onCreated() {
  added.value = 'Transaction ajoutée.';
  emit('created');
}

const row =
  'flex w-full items-center gap-3 rounded-xl border bg-card px-4 py-3 text-left outline-none active:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50';
const tile = 'flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground';
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent
      side="bottom"
      class="max-h-[90dvh] gap-0 overflow-y-auto rounded-t-2xl pb-[calc(1rem+env(safe-area-inset-bottom))]"
    >
      <!-- Entering one by hand: no visible heading, the form says it already
           (kept for screen readers) -->
      <SheetHeader :class="manual && 'sr-only'">
        <SheetTitle>{{ manual ? 'Saisir une transaction' : 'Ajouter des transactions' }}</SheetTitle>
        <SheetDescription>
          {{
            manual
              ? 'Une transaction à ajouter à un de vos comptes.'
              : 'Importez le relevé de votre banque, ou saisissez une transaction.'
          }}
        </SheetDescription>
      </SheetHeader>

      <div class="flex flex-col gap-3 px-4" :class="manual && 'pt-3'">
        <p v-if="accounts.length === 0" class="text-sm text-muted-foreground">
          Créez d'abord un compte dans l'onglet Accueil.
        </p>
        <template v-else-if="manual">
          <Button variant="ghost" size="sm" class="-ml-2 self-start" @click="showManual(false)">
            <ChevronLeft />
            Retour
          </Button>
          <TransactionForm
            :accounts="accounts"
            :categories="categories"
            @created="onCreated"
            @error="emit('error', $event)"
          />
          <p v-if="added" class="text-sm text-emerald-600">{{ added }}</p>
        </template>
        <template v-else>
          <button type="button" :class="row" :disabled="loading" @click="input?.click()">
            <span :class="tile"><Upload class="size-4" /></span>
            <span class="flex min-w-0 flex-col">
              <span class="font-medium">{{ loading ? 'Lecture en cours…' : 'Importer un relevé CSV' }}</span>
              <span class="text-sm text-muted-foreground">CIBC et BNC</span>
            </span>
            <ChevronRight class="ml-auto size-4 text-muted-foreground" />
          </button>
          <input ref="input" type="file" accept=".csv,text/csv" hidden @change="onInputChange" />

          <p v-if="message" class="text-sm text-emerald-600">{{ message }}</p>
          <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
          <!-- Nothing to import: said here, there is no preview -->
          <template v-if="result && result.transactions.length === 0">
            <p class="text-sm text-destructive">Aucune transaction trouvée dans ce fichier.</p>
            <ParseErrors :errors="result.errors" />
          </template>

          <button type="button" :class="row" @click="showManual(true)">
            <span :class="tile"><PencilLine class="size-4" /></span>
            <span class="font-medium">Saisir une transaction</span>
            <ChevronRight class="ml-auto size-4 text-muted-foreground" />
          </button>
        </template>
      </div>
    </SheetContent>
  </Sheet>

  <!-- The usual import preview, over the sheet -->
  <AccountDialog
    v-if="dialogOpen && result"
    :accounts="accounts"
    :categories="categories"
    :result="result"
    @cancel="reset"
    @done="onDone"
  />
</template>
