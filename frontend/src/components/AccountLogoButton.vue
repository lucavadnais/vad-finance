<script setup lang="ts">
// The account's image as a button: pick a new file to replace it
import type { Account } from '@/types';
import { ref } from 'vue';
import { api, LOGO_TYPES } from '@/api';
import AccountLogo from './AccountLogo.vue';

const props = defineProps<{ account: Account }>();
const emit = defineEmits<{ changed: []; error: [message: string] }>();

const input = ref<HTMLInputElement | null>(null);

async function onChange(e: Event) {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  target.value = '';
  if (!file) return;
  if (!LOGO_TYPES.includes(file.type)) {
    emit('error', 'Image PNG, JPEG, WebP ou GIF seulement');
    return;
  }
  try {
    await api.uploadAccountLogo(props.account._id, file);
    emit('changed');
  } catch (err) {
    emit('error', (err as Error).message);
  }
}
</script>

<template>
  <button
    type="button"
    class="rounded outline-none hover:opacity-70 focus-visible:ring-3 focus-visible:ring-ring/50"
    :title="`Changer l'image de ${account.name}`"
    :aria-label="`Changer l'image de ${account.name}`"
    @click="input?.click()"
  >
    <AccountLogo :account="account" />
  </button>
  <input ref="input" type="file" :accept="LOGO_TYPES.join(',')" hidden @change="onChange" />
</template>
