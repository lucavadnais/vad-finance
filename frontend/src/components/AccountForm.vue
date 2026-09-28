<script setup lang="ts">
import type { AccountType } from '@/types';
import { onBeforeUnmount, ref } from 'vue';
import { ImagePlus, X } from '@lucide/vue';
import { api, LOGO_TYPES, toCents } from '@/api';
import { ACCOUNT_TYPES } from '@/lib/labels';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import OptionSelect from './OptionSelect.vue';

const emit = defineEmits<{ created: []; error: [message: string] }>();

const name = ref('');
const type = ref<AccountType>('checking');
const initialBalance = ref('0');

// Optional image (bank logo...), uploaded right after the account is created
const logoInput = ref<HTMLInputElement | null>(null);
const logo = ref<File | null>(null);
const preview = ref<string | null>(null);

function setLogo(file: File | null) {
  if (preview.value) URL.revokeObjectURL(preview.value);
  logo.value = file;
  preview.value = file ? URL.createObjectURL(file) : null;
}

function onLogoChange(e: Event) {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0] ?? null;
  target.value = '';
  if (file && !LOGO_TYPES.includes(file.type)) {
    emit('error', 'Image PNG, JPEG, WebP ou GIF seulement');
    return;
  }
  setLogo(file);
}

onBeforeUnmount(() => setLogo(null));

async function submit() {
  try {
    const account = await api.createAccount({
      name: name.value,
      type: type.value,
      initialBalanceCents: toCents(initialBalance.value),
    });
    if (logo.value) await api.uploadAccountLogo(account._id, logo.value);
    name.value = '';
    initialBalance.value = '0';
    setLogo(null);
    emit('created');
  } catch (err) {
    emit('error', (err as Error).message);
  }
}
</script>

<template>
  <form class="flex flex-wrap items-center gap-2" @submit.prevent="submit">
    <Input v-model="name" placeholder="Nom du compte" required class="w-56" />
    <OptionSelect v-model="type" :options="ACCOUNT_TYPES" class="w-36" />
    <Input v-model="initialBalance" placeholder="Solde initial" class="w-32" />

    <div v-if="preview" class="flex items-center gap-1 rounded-md border px-1.5 py-1">
      <img :src="preview" alt="Image du compte" class="size-6 rounded object-contain" />
      <Button type="button" size="icon-xs" variant="ghost" aria-label="Retirer l'image" @click="setLogo(null)">
        <X />
      </Button>
    </div>
    <Button v-else type="button" variant="outline" @click="logoInput?.click()">
      <ImagePlus />
      Image
    </Button>
    <input ref="logoInput" type="file" :accept="LOGO_TYPES.join(',')" hidden @change="onLogoChange" />

    <Button type="submit">Ajouter le compte</Button>
  </form>
</template>
