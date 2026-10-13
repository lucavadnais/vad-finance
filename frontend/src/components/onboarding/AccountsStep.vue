<script setup lang="ts">
// Setup wizard, step "Comptes": the accounts created so far, each edited (and
// deleted) through the usual account dialog, which also adds more. "Suivant"
// (submit) needs at least one account: the rest of the app (import,
// transactions) depends on it.
import { ref } from 'vue';
import { Pencil, Plus } from '@lucide/vue';
import { useFinanceData } from '@/composables/useFinanceData';
import { ACCOUNT_TYPES } from '@/lib/labels';
import { Button } from '@/components/ui/button';
import AccountForm from '../AccountForm.vue';
import AccountLogo from '../AccountLogo.vue';

const { accounts, refresh } = useFinanceData();

const error = ref('');

async function onCreated() {
  error.value = '';
  await refresh();
}

// Called on "Suivant": false keeps the wizard on this step
async function submit() {
  if (accounts.value.length > 0) return true;
  error.value = 'Ajoutez au moins un compte pour continuer.';
  return false;
}
defineExpose({ submit });
</script>

<template>
  <div class="flex flex-col gap-4">
    <ul v-if="accounts.length > 0" class="flex flex-col divide-y rounded-xl border">
      <li v-for="a in accounts" :key="a._id" class="flex items-center gap-3 px-4 py-3">
        <AccountLogo :account="a" />
        <span class="flex min-w-0 flex-wrap gap-x-2">
          <span class="font-medium">{{ a.name }}</span>
          <span class="text-muted-foreground">({{ ACCOUNT_TYPES[a.type] }})</span>
        </span>
        <AccountForm :account="a" :accounts="accounts" @changed="refresh" @error="error = $event">
          <Button
            size="icon-sm"
            variant="ghost"
            class="ml-auto shrink-0"
            :aria-label="`Modifier ${a.name}`"
            :title="`Modifier ${a.name}`"
          >
            <Pencil />
          </Button>
        </AccountForm>
      </li>
    </ul>

    <!-- Adding one: dashed, as under the accounts on the home page -->
    <AccountForm @created="onCreated" @error="error = $event">
      <button
        type="button"
        class="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/40 p-3 text-sm font-medium text-foreground/80 transition-colors hover:bg-muted/50"
      >
        {{ accounts.length > 0 ? 'Ajouter un autre compte' : 'Ajouter un compte' }}
        <Plus class="size-5 shrink-0" />
      </button>
    </AccountForm>

    <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
  </div>
</template>
