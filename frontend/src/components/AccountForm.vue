<script setup lang="ts">
import type { AccountType } from '@/types';
import { ref } from 'vue';
import { api, toCents } from '@/api';
import { ACCOUNT_TYPES } from '@/lib/labels';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import OptionSelect from './OptionSelect.vue';

const emit = defineEmits<{ created: []; error: [message: string] }>();

const name = ref('');
const type = ref<AccountType>('checking');
const initialBalance = ref('0');

async function submit() {
  try {
    await api.createAccount({
      name: name.value,
      type: type.value,
      initialBalanceCents: toCents(initialBalance.value),
    });
    name.value = '';
    initialBalance.value = '0';
    emit('created');
  } catch (err) {
    emit('error', (err as Error).message);
  }
}
</script>

<template>
  <form class="flex flex-wrap gap-2" @submit.prevent="submit">
    <Input v-model="name" placeholder="Nom du compte" required class="w-56" />
    <OptionSelect v-model="type" :options="ACCOUNT_TYPES" class="w-36" />
    <Input v-model="initialBalance" placeholder="Solde initial" class="w-32" />
    <Button type="submit">Ajouter le compte</Button>
  </form>
</template>
