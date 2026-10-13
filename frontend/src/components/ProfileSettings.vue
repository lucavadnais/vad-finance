<script setup lang="ts">
// "Profil" section of the settings: who is signed in (from their Google
// account), and deleting the account with all its data. Typing the email
// confirms it, since nothing can be recovered afterwards.
import { computed, ref, watch } from 'vue';
import { CircleUser } from '@lucide/vue';
import { useAuth } from '@/composables/useAuth';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const { user, deleteAccount } = useAuth();

const pictureFailed = ref(false);

const confirmOpen = ref(false);
const typed = ref('');
const deleting = ref(false);
// Shown in the confirmation: the settings dialog's message is behind it
const error = ref('');
watch(confirmOpen, () => {
  typed.value = '';
  error.value = '';
});
const confirmed = computed(() => typed.value.trim().toLowerCase() === user.value?.email);

async function remove() {
  if (!confirmed.value) return;
  deleting.value = true;
  error.value = '';
  try {
    // Leaves the page on success
    await deleteAccount();
  } catch (err) {
    error.value = (err as Error).message;
    deleting.value = false;
  }
}
</script>

<template>
  <!-- A section of the settings dialog -->
  <section v-if="user" class="flex flex-col gap-6">
    <header class="flex flex-col gap-1 pr-6">
      <h2 class="text-lg font-semibold">Profil</h2>
      <p class="text-sm text-muted-foreground">Votre compte, relié à votre compte Google.</p>
    </header>

    <div class="flex items-center gap-3">
      <img
        v-if="user.picture && !pictureFailed"
        :src="user.picture"
        alt=""
        referrerpolicy="no-referrer"
        class="size-12 rounded-full"
        @error="pictureFailed = true"
      />
      <CircleUser v-else class="size-12 text-muted-foreground" />
      <div class="flex min-w-0 flex-col">
        <span v-if="user.name" class="truncate font-medium">{{ user.name }}</span>
        <span class="truncate text-sm text-muted-foreground">{{ user.email }}</span>
      </div>
    </div>

    <div class="flex max-w-lg flex-col items-start gap-2 rounded-lg border border-destructive/30 p-4">
      <h3 class="font-medium">Supprimer mon compte</h3>
      <p class="text-sm text-muted-foreground">
        Efface définitivement votre compte et toutes vos données : comptes, transactions, catégories, prévisions et
        paramètres. Impossible de revenir en arrière.
      </p>
      <AlertDialog v-model:open="confirmOpen">
        <AlertDialogTrigger as-child>
          <Button variant="destructive">Supprimer mon compte</Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <form class="contents" @submit.prevent="remove">
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer votre compte ?</AlertDialogTitle>
              <AlertDialogDescription>
                Toutes vos données seront effacées définitivement. Pour confirmer, saisissez votre adresse
                <strong class="font-medium text-foreground">{{ user.email }}</strong>.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div class="flex flex-col gap-2">
              <Label for="delete-confirm" class="sr-only">Adresse courriel</Label>
              <Input
                id="delete-confirm"
                v-model="typed"
                type="email"
                autocomplete="off"
                autocapitalize="off"
                :placeholder="user.email"
              />
              <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel :disabled="deleting">Annuler</AlertDialogCancel>
              <Button type="submit" variant="destructive" :disabled="!confirmed || deleting">
                {{ deleting ? 'Suppression…' : 'Supprimer définitivement' }}
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  </section>
</template>
