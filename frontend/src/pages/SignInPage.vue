<script setup lang="ts">
// Shown instead of the app while nobody is signed in (App.vue), at whatever
// address was opened: once signed in, that page shows.
import { onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { api } from '@/api';
import { useAuth } from '@/composables/useAuth';
import { loadGoogleIdentity } from '@/lib/googleIdentity';
import { Button } from '@/components/ui/button';

const { signIn, signInAsTestUser } = useAuth();

// Google draws its button in there
const button = ref<HTMLElement>();
const loading = ref(true);
const error = ref('');
// Local tests: the server allows signing in as a test user (DEV_LOGIN=1)
const devLogin = ref(false);

async function onTestUser() {
  error.value = '';
  try {
    await signInAsTestUser();
  } catch (err) {
    error.value = (err as Error).message;
  }
}

onMounted(async () => {
  try {
    const { googleClientId, devLogin: dev } = await api.getAuthConfig();
    devLogin.value = dev;
    if (!googleClientId) {
      error.value = "La connexion Google n'est pas configurée sur le serveur (GOOGLE_CLIENT_ID).";
      return;
    }
    const google = await loadGoogleIdentity();
    google.initialize({
      client_id: googleClientId,
      callback: async ({ credential }) => {
        error.value = '';
        try {
          await signIn(credential);
        } catch (err) {
          error.value = (err as Error).message;
        }
      },
    });
    if (button.value) {
      google.renderButton(button.value, {
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        shape: 'pill',
        width: 280,
        locale: 'fr',
      });
    }
  } catch {
    error.value =
      'Impossible de charger la connexion Google. Vérifiez votre connexion Internet, puis rechargez la page.';
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <main class="flex min-h-dvh flex-col items-center justify-center px-4 py-8">
    <div class="flex w-full max-w-sm flex-col items-center gap-6 rounded-xl border bg-card p-8 text-center shadow-sm">
      <img src="/logo.svg" alt="" class="size-14 rounded-xl" />
      <div class="flex flex-col gap-1">
        <h1 class="text-2xl font-semibold">VAD finances</h1>
        <p class="text-sm text-muted-foreground">Connectez-vous pour accéder à vos finances.</p>
      </div>
      <!-- Google replaces the content of its element: nothing of Vue's in it -->
      <div class="flex min-h-11 items-center justify-center">
        <span v-if="loading" class="text-sm text-muted-foreground">Chargement…</span>
        <div ref="button" />
      </div>
      <Button v-if="devLogin" variant="outline" class="rounded-full" @click="onTestUser">
        Se connecter comme utilisateur de test
      </Button>
      <p v-if="error" class="text-sm text-destructive" role="alert">{{ error }}</p>
    </div>
    <!-- Under the card: what signing in agrees to -->
    <p class="mt-4 max-w-sm text-center text-xs text-muted-foreground">
      En vous connectant, vous acceptez les
      <RouterLink to="/terms" class="underline underline-offset-2 hover:text-foreground"
        >conditions d'utilisation</RouterLink
      >
      et la
      <RouterLink to="/privacy" class="underline underline-offset-2 hover:text-foreground"
        >politique de confidentialité</RouterLink
      >.
    </p>
  </main>
</template>
