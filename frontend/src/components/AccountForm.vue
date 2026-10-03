<script setup lang="ts">
// Dialog that creates an account, or edits one when `account` is given. The
// trigger is the default slot ("Ajouter un compte" button when empty).
import type { Account, AccountType } from '@/types';
import { computed, onBeforeUnmount, ref } from 'vue';
import { ImagePlus, Plus, Trash2, X } from '@lucide/vue';
import { accountLogoUrl, api, formatCents, LOGO_TYPES, toCents } from '@/api';
import { ACCOUNT_TYPES } from '@/lib/labels';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AccountDeleteDialog from './AccountDeleteDialog.vue';
import OptionSelect from './OptionSelect.vue';

// `accounts`: all of them, to pick where the transactions go on delete
const props = defineProps<{ account?: Account; accounts?: Account[] }>();
const emit = defineEmits<{ created: []; changed: []; error: [message: string] }>();

const editing = computed(() => !!props.account);

const open = ref(false);
const deleteOpen = ref(false);
const name = ref('');
const type = ref<AccountType>('checking');
const initialBalance = ref('0');
const saving = ref(false);
const error = ref('');

// Optional image (bank logo...), uploaded right after the account is saved.
// When editing, `removeLogo` drops the current one instead.
const logoInput = ref<HTMLInputElement | null>(null);
const logo = ref<File | null>(null);
const preview = ref<string | null>(null);
const removeLogo = ref(false);
const currentLogo = computed(() => (props.account && !removeLogo.value ? accountLogoUrl(props.account) : null));
const shownLogo = computed(() => preview.value ?? currentLogo.value);

function setLogo(file: File | null) {
  if (preview.value) URL.revokeObjectURL(preview.value);
  logo.value = file;
  preview.value = file ? URL.createObjectURL(file) : null;
}

function clearLogo() {
  if (logo.value) setLogo(null);
  else removeLogo.value = true;
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

// Every opening starts from the account (or an empty form)
function onOpenChange(value: boolean) {
  if (saving.value) return;
  if (value) {
    const a = props.account;
    name.value = a?.name ?? '';
    type.value = a?.type ?? 'checking';
    initialBalance.value = a ? String(a.initialBalanceCents / 100).replace('.', ',') : '0';
    error.value = '';
    removeLogo.value = false;
    setLogo(null);
  }
  open.value = value;
}

const balanceChanged = computed(
  () => !!props.account && toCents(initialBalance.value) !== props.account.initialBalanceCents,
);

function notify() {
  if (editing.value) emit('changed');
  else emit('created');
}

async function submit() {
  saving.value = true;
  error.value = '';
  const body = { name: name.value, type: type.value, initialBalanceCents: toCents(initialBalance.value) };
  try {
    const account = props.account ? await api.updateAccount(props.account._id, body) : await api.createAccount(body);
    // The account is saved now: close even if the image fails, so it is not created twice
    open.value = false;
    notify();
    try {
      if (logo.value) await api.uploadAccountLogo(account._id, logo.value);
      else if (removeLogo.value) await api.deleteAccountLogo(account._id);
      else return;
      notify();
    } catch (err) {
      emit('error', `Compte enregistré, mais l'image n'a pas pu être mise à jour : ${(err as Error).message}`);
    }
  } catch (err) {
    error.value = (err as Error).message;
  } finally {
    saving.value = false;
  }
}

function askDelete() {
  open.value = false;
  deleteOpen.value = true;
}
</script>

<template>
  <Dialog :open="open" @update:open="onOpenChange">
    <DialogTrigger as-child>
      <slot>
        <Button size="sm">
          <Plus />
          Ajouter un compte
        </Button>
      </slot>
    </DialogTrigger>
    <DialogContent class="sm:max-w-md">
      <form class="flex flex-col gap-4" @submit.prevent="submit">
        <DialogHeader>
          <DialogTitle>{{ editing ? 'Modifier le compte' : 'Nouveau compte' }}</DialogTitle>
          <DialogDescription>Le solde initial est le solde avant la première transaction.</DialogDescription>
        </DialogHeader>

        <DialogBody>
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
          <!-- Changing it shifts the whole balance history, not just today's balance -->
          <p v-if="balanceChanged && account" class="text-sm text-muted-foreground">
            Le solde actuel passera de {{ formatCents(account.balanceCents, account.currency) }} à
            {{
              formatCents(
                account.balanceCents - account.initialBalanceCents + toCents(initialBalance),
                account.currency,
              )
            }}, et tout l'historique du solde sera décalé d'autant.
          </p>
          <div class="flex flex-col gap-2">
            <Label>Image <span class="font-normal text-muted-foreground">(facultative)</span></Label>
            <div v-if="shownLogo" class="flex w-fit items-center gap-1 rounded-md border px-1.5 py-1">
              <img :src="shownLogo" alt="Image du compte" class="size-6 rounded object-contain" />
              <Button type="button" size="icon-xs" variant="ghost" aria-label="Retirer l'image" @click="clearLogo">
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
        </DialogBody>

        <DialogFooter>
          <Button
            v-if="editing"
            type="button"
            variant="ghost"
            class="text-destructive hover:text-destructive sm:mr-auto"
            :disabled="saving"
            @click="askDelete"
          >
            <Trash2 />
            Supprimer le compte
          </Button>
          <Button type="button" variant="outline" :disabled="saving" @click="onOpenChange(false)"> Annuler </Button>
          <Button type="submit" :disabled="saving">
            {{ saving ? 'Enregistrement…' : editing ? 'Enregistrer' : 'Créer le compte' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>

  <AccountDeleteDialog
    v-if="account"
    v-model:open="deleteOpen"
    :account="account"
    :accounts="accounts ?? []"
    @deleted="emit('changed')"
  />
</template>
