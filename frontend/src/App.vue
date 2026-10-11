<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { RouterView, useRoute } from 'vue-router';
import { Settings } from '@lucide/vue';
import { useFinanceData } from '@/composables/useFinanceData';
import { useSelectedMonth, useSelectedPeriod } from '@/composables/useSelectedMonth';
import { PERIODS } from '@/lib/chartData';
import { useSettings } from '@/composables/useSettings';
import { Button } from '@/components/ui/button';
import MonthStepper from '@/components/MonthStepper.vue';
import OptionSelect from '@/components/OptionSelect.vue';
import SettingsDialog from '@/components/SettingsDialog.vue';

const { error, refresh } = useFinanceData();
const { open: settingsOpen, openSettings } = useSettings();

onMounted(refresh);

// The period and month of the home page (not of an account's page)
const route = useRoute();
const isHome = computed(() => route.name !== 'account');
const month = useSelectedMonth();
const period = useSelectedPeriod();

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
  <main class="mx-auto flex max-w-screen-2xl flex-col gap-6 px-4 py-4 md:px-6 md:py-8 xl:px-12 2xl:px-16">
    <!-- Computer: stuck to the top while the page scrolls, with the home's
         month, which the cards follow. A phone has a bar per
         tab instead (and all the accounts) -->
    <header
      class="flex flex-wrap items-center gap-4 md:sticky md:top-0 md:z-30 md:-mx-6 md:-my-3 md:bg-background/90 md:px-6 md:py-3 md:backdrop-blur xl:-mx-12 xl:px-12 2xl:-mx-16 2xl:px-16"
    >
      <h1 class="mr-auto text-lg font-semibold md:text-3xl">VAD finances</h1>
      <!-- What the whole page follows (useSelectedMonth): the period, and with
           "Mois par mois" the month's arrows, before it -->
      <template v-if="isHome">
        <MonthStepper v-if="period === 'month'" v-model="month" class="max-md:hidden" />
        <OptionSelect v-model="period" :options="PERIODS" class="w-auto max-md:hidden" aria-label="Période" />
      </template>
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
