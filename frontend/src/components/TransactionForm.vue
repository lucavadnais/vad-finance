<script setup>
import { ref } from 'vue';
import { api, toCents } from '../api.js';

const props = defineProps({ accounts: { type: Array, required: true } });
const emit = defineEmits(['created', 'error']);

const account = ref(props.accounts[0]._id);
const date = ref(new Date().toISOString().slice(0, 10));
const description = ref('');
const amount = ref('');

async function submit() {
  try {
    await api.createTransaction({
      account: account.value,
      date: date.value,
      description: description.value,
      amountCents: toCents(amount.value),
    });
    description.value = '';
    amount.value = '';
    emit('created');
  } catch (err) {
    emit('error', err.message);
  }
}
</script>

<template>
  <form @submit.prevent="submit">
    <select v-model="account">
      <option v-for="a in accounts" :key="a._id" :value="a._id">{{ a.name }}</option>
    </select>
    <input v-model="date" type="date" required />
    <input v-model="description" placeholder="Description" />
    <input v-model="amount" placeholder="Montant (négatif = dépense)" required />
    <button type="submit">Ajouter</button>
  </form>
</template>
