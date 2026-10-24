<script setup lang="ts">
// Dialog that creates an account, or edits one when `account` is given. The
// trigger is the default slot ("Ajouter un compte" button when empty). A new
// account has no initial balance yet: its first CSV import asks for its
// current balance and works it out (AccountDialog); editing can change it.
import type { Account, AccountType } from '@/types';
import { computed, onBeforeUnmount, ref } from 'vue';
import { ImagePlus, Info, Plus, Trash2 } from '@lucide/vue';
import { accountLogoUrl, api, formatCents, LOGO_TYPES, toCents } from '@/api';
import { ACCOUNT_TYPES } from '@/lib/labels';
import { useAmountsHidden } from '@/composables/useAmountsHidden';
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
import InfoTooltip from './InfoTooltip.vue';
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

// Optional image, sent right after the account is saved: one of the logos
// below (public/account-logos) or a custom one. The custom tile holds the file
// just picked, else the account's current image. Clicking a tile selects it,
// clicking it again unselects it; nothing is replaced or removed before saving.
const presetSrc = (key: string) => `/account-logos/${key}.png`;
const PRESET_LOGOS = [
  { key: 'desjardins', label: 'Desjardins' },
  { key: 'bnc', label: 'Banque Nationale' },
  { key: 'cibc', label: 'CIBC' },
  { key: 'visa', label: 'Visa' },
  { key: 'mastercard', label: 'Mastercard' },
].map((logo) => ({ ...logo, src: presetSrc(logo.key) }));
const CUSTOM = 'custom';
// CUSTOM, a preset key, or null for no image
const selected = ref<string | null>(null);
const logoInput = ref<HTMLInputElement | null>(null);
const logo = ref<File | null>(null);
const preview = ref<string | null>(null);
const customLogo = computed(() => preview.value ?? (props.account ? accountLogoUrl(props.account) : null));

function setLogo(file: File | null) {
  if (preview.value) URL.revokeObjectURL(preview.value);
  logo.value = file;
  preview.value = file ? URL.createObjectURL(file) : null;
}

function toggle(key: string) {
  selected.value = selected.value === key ? null : key;
}

function onLogoChange(e: Event) {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0] ?? null;
  target.value = '';
  if (!file) return;
  if (!LOGO_TYPES.includes(file.type)) {
    error.value = 'Image PNG, JPEG, WebP ou GIF seulement';
    return;
  }
  error.value = '';
  setLogo(file);
  selected.value = CUSTOM;
}

// A preset is sent like a custom file, so the account keeps its own copy
async function presetFile(key: string) {
  const res = await fetch(presetSrc(key));
  if (!res.ok) throw new Error('logo introuvable');
  return new File([await res.blob()], `${key}.png`, { type: 'image/png' });
}

// After the account is saved: true when its image changed
async function saveLogo(id: string) {
  if (selected.value === CUSTOM) {
    // The account's current image, still selected: nothing to do
    if (!logo.value) return false;
    await api.uploadAccountLogo(id, logo.value);
  } else if (selected.value) {
    await api.uploadAccountLogo(id, await presetFile(selected.value));
  } else {
    if (!props.account?.logoUpdatedAt) return false;
    await api.deleteAccountLogo(id);
  }
  return true;
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
    setLogo(null);
    selected.value = a?.logoUpdatedAt ? CUSTOM : null;
  }
  open.value = value;
}

const balanceChanged = computed(
  () => !!props.account && toCents(initialBalance.value) !== props.account.initialBalanceCents,
);
const { amountsHidden } = useAmountsHidden();
// By how much: today's balance and every point of its history move by it
const balanceShiftCents = computed(() =>
  props.account ? toCents(initialBalance.value) - props.account.initialBalanceCents : 0,
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
      if (await saveLogo(account._id)) notify();
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
        <!-- Icon only on a phone, so it fits next to the total -->
        <Button size="sm" aria-label="Ajouter un compte" title="Ajouter un compte" class="max-sm:size-8">
          <Plus />
          <span class="max-sm:sr-only">Ajouter un compte</span>
        </Button>
      </slot>
    </DialogTrigger>
    <DialogContent class="sm:max-w-md">
      <form class="flex flex-col gap-4" @submit.prevent="submit">
        <DialogHeader>
          <DialogTitle>{{ editing ? 'Modifier le compte' : 'Nouveau compte' }}</DialogTitle>
          <DialogDescription v-if="editing"> Son nom, son type, son solde initial et son image. </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div class="flex flex-col gap-2">
            <Label for="account-name">Nom</Label>
            <Input id="account-name" v-model="name" placeholder="BNC - Compte chèque" required />
          </div>
          <div class="grid gap-4" :class="editing && 'grid-cols-2'">
            <div class="flex flex-col gap-2">
              <Label for="account-type">Type</Label>
              <OptionSelect id="account-type" v-model="type" :options="ACCOUNT_TYPES" class="w-full" />
            </div>
            <div v-if="editing" class="flex flex-col gap-2">
              <Label for="account-balance">
                Solde initial
                <InfoTooltip>Le solde du compte avant sa première transaction.</InfoTooltip>
              </Label>
              <Input id="account-balance" v-model="initialBalance" inputmode="decimal" />
            </div>
          </div>
          <!-- Changing it shifts the whole balance history, not just today's balance -->
          <p v-if="balanceChanged && account" class="text-sm text-muted-foreground">
            Le solde actuel passera de {{ formatCents(account.balanceCents, account.currency) }} à
            {{ formatCents(account.balanceCents + balanceShiftCents, account.currency) }} ({{
              balanceShiftCents > 0 && !amountsHidden ? '+' : ''
            }}{{ formatCents(balanceShiftCents, account.currency) }}). Toute la courbe du solde se déplacera du même
            montant ; vos transactions ne changent pas.
          </p>
          <div class="flex flex-col gap-2">
            <Label>Image <span class="font-normal text-muted-foreground">(facultative)</span></Label>
            <div class="flex flex-wrap items-center gap-2">
              <Button
                v-if="customLogo"
                type="button"
                variant="outline"
                size="icon"
                aria-label="Image personnalisée"
                title="Image personnalisée"
                :aria-pressed="selected === CUSTOM"
                :class="selected === CUSTOM && 'border-2 border-primary'"
                @click="toggle(CUSTOM)"
              >
                <img :src="customLogo" alt="" class="size-6 rounded object-contain" />
              </Button>
              <Button
                v-for="p in PRESET_LOGOS"
                :key="p.key"
                type="button"
                variant="outline"
                size="icon"
                :aria-label="p.label"
                :title="p.label"
                :aria-pressed="selected === p.key"
                :class="selected === p.key && 'border-2 border-primary'"
                @click="toggle(p.key)"
              >
                <img :src="p.src" alt="" class="size-6 object-contain" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Choisir une image personnalisée"
                title="Choisir une image personnalisée"
                @click="logoInput?.click()"
              >
                <ImagePlus />
              </Button>
            </div>
            <input ref="logoInput" type="file" :accept="LOGO_TYPES.join(',')" hidden @change="onLogoChange" />
          </div>

          <!-- A new account: where its balance will come from -->
          <div v-if="!editing" class="flex gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm">
            <Info class="mt-0.5 size-4 shrink-0" />
            <p>Son solde vous sera demandé au premier import de relevé.</p>
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
