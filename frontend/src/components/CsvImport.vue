<script setup lang="ts">
// "Ajouter des transactions" card (tablet, computer; a phone uses the add
// sheet of its tab bar): a bank statement dropped or picked (useCsvImport), or
// one transaction entered by hand.
import type { Account, Category } from '@/types';
import { ref } from 'vue';
import { ChevronRight, Upload } from '@lucide/vue';
import { useCsvImport } from '@/composables/useCsvImport';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import AccountDialog from './AccountDialog.vue';
import ParseErrors from './ParseErrors.vue';
import TransactionForm from './TransactionForm.vue';

defineProps<{ accounts: Account[]; categories: Category[] }>();
// `imported` after a CSV import, `created` after a manual entry
const emit = defineEmits<{ imported: []; created: []; error: [message: string] }>();

const { loading, fileName, result, dialogOpen, message, error, handleFile, onInputChange, reset, onDone } =
  useCsvImport(() => emit('imported'));

const input = ref<HTMLInputElement | null>(null);
const dragging = ref(false);
const manualOpen = ref(false);

function onDrop(e: DragEvent) {
  dragging.value = false;
  handleFile(e.dataTransfer?.files[0]);
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>Ajouter des transactions</CardTitle>
    </CardHeader>
    <CardContent class="flex flex-col gap-4">
      <div
        role="button"
        tabindex="0"
        class="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-10 text-center transition-colors"
        :class="dragging ? 'border-primary bg-muted' : 'border-border hover:bg-muted/50'"
        @click="input?.click()"
        @keydown.enter.space.prevent="input?.click()"
        @dragover.prevent="dragging = true"
        @dragleave="dragging = false"
        @drop.prevent="onDrop"
      >
        <Upload class="size-8 text-muted-foreground" />
        <p class="font-medium">
          <template v-if="loading">Lecture en cours…</template>
          <template v-else-if="fileName">{{ fileName }}</template>
          <template v-else>Glissez votre relevé CSV ici</template>
        </p>
        <p v-if="!loading && !fileName" class="text-sm text-muted-foreground">Banques supportées : CIBC & BNC</p>
        <input ref="input" type="file" accept=".csv,text/csv" hidden @change="onInputChange" />
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
          <p v-else class="text-sm text-muted-foreground">Créez d'abord un compte dans la carte Comptes.</p>
        </CollapsibleContent>
      </Collapsible>
    </CardContent>
  </Card>
</template>
