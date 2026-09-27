<script setup>
// Asks which account the file belongs to. The file name gives the account name
// and the bank, but not the account type, so the user picks the type here.
import { computed, onMounted, ref } from 'vue';
import { api, formatCents } from '../api.js';
import { ACCOUNT_TYPES, BANKS } from '../lib/banks.js';
import ParseErrors from './ParseErrors.vue';

const props = defineProps({
  accounts: { type: Array, required: true },
  result: { type: Object, required: true },
});
const emit = defineEmits(['cancel', 'done']);

const dialog = ref(null);
const name = ref(props.result.accountName);
const type = ref(findAccount(props.result.accountName)?.type ?? 'checking');
const saving = ref(false);
const error = ref('');

onMounted(() => dialog.value.showModal());

const existing = computed(() => findAccount(name.value, type.value));
const bank = computed(() => BANKS[props.result.bank]);
const count = computed(() => props.result.transactions.length);

// Same bank and name (case-insensitive), and same type when given
function findAccount(accountName, accountType) {
  const wanted = accountName.trim().toLowerCase();
  return props.accounts.find(
    (a) =>
      (a.bank ?? null) === props.result.bank &&
      a.name.trim().toLowerCase() === wanted &&
      (accountType === undefined || a.type === accountType),
  );
}

async function submit() {
  saving.value = true;
  error.value = '';
  try {
    const account =
      existing.value ??
      (await api.createAccount({
        name: name.value.trim(),
        type: type.value,
        bank: props.result.bank ?? undefined,
      }));
    const summary = await api.importTransactions({
      account: account._id,
      transactions: props.result.transactions,
    });
    emit('done', account, summary);
  } catch (err) {
    error.value = err.message;
    saving.value = false;
  }
}
</script>

<template>
  <dialog
    ref="dialog"
    class="m-auto w-full max-w-3xl rounded-lg p-6 shadow-xl backdrop:bg-black/40"
    @close="emit('cancel')"
  >
    <form class="m-0 flex-col gap-4" @submit.prevent="submit">
      <div class="flex items-center gap-3">
        <img v-if="bank" :src="bank.logo" :alt="bank.name" class="size-10 rounded-md" />
        <h3 class="text-lg font-semibold">Dans quel compte importer ?</h3>
      </div>

      <label class="flex flex-col gap-1">
        Nom du compte
        <input v-model="name" required />
      </label>

      <label class="flex flex-col gap-1">
        Type de compte
        <select v-model="type">
          <option v-for="(label, value) in ACCOUNT_TYPES" :key="value" :value="value">
            {{ label }}
          </option>
        </select>
      </label>

      <div>
        <p class="mb-2 font-medium">
          {{ count }} transaction(s) lue(s){{
            result.errors.length > 0 ? `, ${result.errors.length} ligne(s) ignorée(s)` : ''
          }}
        </p>
        <ParseErrors :errors="result.errors" />
        <div class="max-h-72 overflow-y-auto rounded-md border">
          <table>
            <thead class="sticky top-0 bg-background">
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Montant</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(t, i) in result.transactions" :key="i">
                <td class="whitespace-nowrap">{{ t.date }}</td>
                <td>{{ t.description }}</td>
                <td class="whitespace-nowrap" :class="t.amountCents < 0 ? 'negative' : 'positive'">
                  {{ formatCents(t.amountCents) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <p class="text-sm text-muted-foreground">
        <template v-if="existing">
          Les {{ count }} transaction(s) seront ajoutées au compte existant.
        </template>
        <template v-else>
          Un nouveau compte{{ bank ? ` ${bank.name}` : '' }} sera créé avec {{ count }} transaction(s).
        </template>
      </p>

      <p v-if="error" class="error">{{ error }}</p>

      <div class="flex justify-end gap-2">
        <button type="button" :disabled="saving" @click="dialog.close()">Annuler</button>
        <button type="submit" :disabled="saving">{{ saving ? 'Import…' : 'Importer' }}</button>
      </div>
    </form>
  </dialog>
</template>
