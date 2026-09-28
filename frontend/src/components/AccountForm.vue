<script setup lang="ts">
// "Ajouter un compte" button and the dialog that creates the account
import type { AccountType } from '@/types';
import { onBeforeUnmount, ref } from 'vue';
import { ImagePlus, Plus, X } from '@lucide/vue';
import { api, LOGO_TYPES, toCents } from '@/api';
import { ACCOUNT_TYPES } from '@/lib/labels';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import OptionSelect from './OptionSelect.vue';

const emit = defineEmits<{ created: []; error: [message: string] }>();

const open = ref(false);
const name = ref('');
const type = ref<AccountType>('checking');
const initialBalance = ref('0');
const saving = ref(false);
const error = ref('');

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
    error.value = 'Image PNG, JPEG, WebP ou GIF seulement';
    return;
  }
  error.value = '';
  setLogo(file);
}

onBeforeUnmount(() => setLogo(null));

// Every opening starts from an empty form
function onOpenChange(value: boolean) {
  if (saving.value) return;
  if (value) {
    name.value = '';
    type.value = 'checking';
    initialBalance.value = '0';
    error.value = '';
    setLogo(null);
  }
  open.value = value;
}

async function submit() {
  saving.value = true;
  error.value = '';
  try {
    const account = await api.createAccount({
      name: name.value,
      type: type.value,
      initialBalanceCents: toCents(initialBalance.value),
    });
    // The account exists now: close even if the image fails, so it is not created twice
    open.value = false;
    emit('created');
    if (logo.value) {
      try {
        await api.uploadAccountLogo(account._id, logo.value);
        emit('created');
      } catch (err) {
        emit('error', `Compte créé, mais l'image n'a pas pu être envoyée : ${(err as Error).message}`);
      }
    }
  } catch (err) {
    error.value = (err as Error).message;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="onOpenChange">
    <DialogTrigger as-child>
      <Button size="sm">
        <Plus />
        Ajouter un compte
      </Button>
    </DialogTrigger>
    <DialogContent class="sm:max-w-md">
      <form class="flex flex-col gap-4" @submit.prevent="submit">
        <DialogHeader>
          <DialogTitle>Nouveau compte</DialogTitle>
          <DialogDescription>Le solde initial est le solde avant la première transaction.</DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-2">
          <Label for="account-name">Nom</Label>
          <Input id="account-name" v-model="name" placeholder="BNC - Compte chèque" required />
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-2">
            <Label for="account-type">Type</Label>
            <OptionSelect id="account-type" v-model="type" :options="ACCOUNT_TYPES" class="w-full" />
          </div>
          <div class="flex flex-col gap-2">
            <Label for="account-balance">Solde initial</Label>
            <Input id="account-balance" v-model="initialBalance" inputmode="decimal" />
          </div>
        </div>
        <div class="flex flex-col gap-2">
          <Label>Image <span class="font-normal text-muted-foreground">(facultative)</span></Label>
          <div v-if="preview" class="flex w-fit items-center gap-1 rounded-md border px-1.5 py-1">
            <img :src="preview" alt="Image du compte" class="size-6 rounded object-contain" />
            <Button type="button" size="icon-xs" variant="ghost" aria-label="Retirer l'image" @click="setLogo(null)">
              <X />
            </Button>
          </div>
          <Button v-else type="button" variant="outline" class="w-fit" @click="logoInput?.click()">
            <ImagePlus />
            Choisir une image
          </Button>
          <input ref="logoInput" type="file" :accept="LOGO_TYPES.join(',')" hidden @change="onLogoChange" />
        </div>

        <p v-if="error" class="text-sm text-destructive">{{ error }}</p>

        <DialogFooter>
          <Button type="button" variant="outline" :disabled="saving" @click="onOpenChange(false)">
            Annuler
          </Button>
          <Button type="submit" :disabled="saving">{{ saving ? 'Création…' : 'Créer le compte' }}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
