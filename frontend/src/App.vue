<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { RouterView } from 'vue-router';
import { Settings } from '@lucide/vue';
import { useFinanceData } from '@/composables/useFinanceData';
import { useSettings } from '@/composables/useSettings';
import { Button } from '@/components/ui/button';
import SettingsDialog from '@/components/SettingsDialog.vue';

const { error, refresh } = useFinanceData();
const { open: settingsOpen, openSettings } = useSettings();

onMounted(refresh);

// The settings dialog is mounted when opened, so it lands on top of a dialog
// already open (e.g. from "Gérer les catégories…" in a category picker), and
// unmounted once its closing animation is over
const settingsMounted = ref(false);
watch(settingsOpen, (open) => {
  if (open) settingsMounted.value = true;
  else setTimeout(() => (settingsMounted.value = settingsOpen.value), 200);
});
</script>

<template>
  <main class="mx-auto flex max-w-screen-2xl flex-col gap-6 px-4 py-8 md:px-6 xl:px-12 2xl:px-16">
    <header class="flex flex-wrap items-center gap-4">
      <h1 class="mr-auto text-3xl font-semibold">Mes finances</h1>
      <!-- Will become the user menu (Paramètres, Se déconnecter) with accounts -->
      <Button variant="ghost" size="icon" aria-label="Paramètres" title="Paramètres" @click="openSettings()">
        <Settings />
      </Button>
    </header>

    <p v-if="error" class="text-sm text-destructive">{{ error }}</p>

    <RouterView />
    <SettingsDialog v-if="settingsMounted" />
  </main>
</template>
