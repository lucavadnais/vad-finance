<script setup lang="ts">
import type { Account, Category } from '@/types';
import { computed, ref } from 'vue';
import { api, toCents } from '@/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import CategorySelect from './CategorySelect.vue';
import DatePicker from './DatePicker.vue';
import OptionSelect from './OptionSelect.vue';

const props = defineProps<{ accounts: Account[]; categories: Category[] }>();
const emit = defineEmits<{ created: []; error: [message: string] }>();

const accountOptions = computed(() => Object.fromEntries(props.accounts.map((a) => [a._id, a.name])));

const account = ref(props.accounts[0]._id);
const category = ref<string | null>(null);
const date = ref(new Date().toISOString().slice(0, 10));
const description = ref('');
const amount = ref('');

async function submit() {
  const amountCents = toCents(amount.value);
  if (Number.isNaN(amountCents)) {
    emit('error', 'Montant invalide');
    return;
  }
  try {
    await api.createTransaction({
      account: account.value,
      category: category.value,
      date: date.value,
      description: description.value,
      amountCents,
    });
    description.value = '';
    amount.value = '';
    emit('created');
  } catch (err) {
    emit('error', (err as Error).message);
  }
}
</script>

<template>
  <form class="flex flex-wrap gap-2" @submit.prevent="submit">
    <OptionSelect v-model="account" :options="accountOptions" class="w-44" />
    <DatePicker v-model="date" />
    <Input v-model="description" placeholder="Description" class="w-56" />
    <CategorySelect v-model="category" :categories="categories" class="w-44" />
    <Input v-model="amount" placeholder="Montant (négatif = dépense)" required class="w-52" />
    <Button type="submit">Ajouter</Button>
  </form>
</template>
