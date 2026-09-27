<script setup>
import { ref } from 'vue';
import { api, toCents } from '../api.js';
import { ACCOUNT_TYPES } from '../lib/banks.js';

const emit = defineEmits(['created', 'error']);

const name = ref('');
const type = ref('checking');
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
    emit('error', err.message);
  }
}
</script>

<template>
  <form @submit.prevent="submit">
    <input v-model="name" placeholder="Nom du compte" required />
    <select v-model="type">
      <option v-for="(label, value) in ACCOUNT_TYPES" :key="value" :value="value">
        {{ label }}
      </option>
    </select>
    <input v-model="initialBalance" placeholder="Solde initial" />
    <button type="submit">Ajouter le compte</button>
  </form>
</template>
