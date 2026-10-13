<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { RouterView, useRoute } from 'vue-router';
import { LogOut, Settings } from '@lucide/vue';
import { useAuth } from '@/composables/useAuth';
import { useFinanceData } from '@/composables/useFinanceData';
import { useSelectedMonth, useSelectedPeriod } from '@/composables/useSelectedMonth';
import { PERIODS } from '@/lib/chartData';
import { useSettings } from '@/composables/useSettings';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import MonthStepper from '@/components/MonthStepper.vue';
import OptionSelect from '@/components/OptionSelect.vue';
import SettingsDialog from '@/components/SettingsDialog.vue';
import UserAvatar from '@/components/UserAvatar.vue';
import OnboardingPage from '@/pages/OnboardingPage.vue';
import SignInPage from '@/pages/SignInPage.vue';

const { user, loadUser, signOut } = useAuth();
const { error, settings, refresh, setError } = useFinanceData();
const { open: settingsOpen, openSettings } = useSettings();

onMounted(loadUser);
// Each sign-in (at startup, or again after the session ended) loads the data
watch(user, (now, before) => {
  if (now && !before) refresh();
});

async function onSignOut() {
  try {
    await signOut();
  } catch (err) {
    setError((err as Error).message);
  }
}

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
  <!-- Nothing while the session is checked, so the sign-in page does not flash;
       nor while the settings load, so the app does not flash before the wizard -->
  <SignInPage v-if="user === null" />
  <OnboardingPage v-else-if="user && settings.onboardingDone === false" />
  <main
    v-else-if="user && (settings.onboardingDone !== undefined || error)"
    class="mx-auto flex max-w-screen-2xl flex-col gap-6 px-4 py-4 md:px-6 md:py-8 xl:px-12 2xl:px-16"
  >
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
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="ghost" size="icon" class="rounded-full" aria-label="Menu du compte" title="Menu du compte">
            <UserAvatar :picture="user.picture" class="text-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-60">
          <DropdownMenuLabel class="flex flex-col font-normal">
            <span v-if="user.name" class="truncate font-medium">{{ user.name }}</span>
            <span class="truncate text-xs text-muted-foreground">{{ user.email }}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem @select="openSettings()">
            <Settings />
            Paramètres
          </DropdownMenuItem>
          <DropdownMenuItem @select="onSignOut">
            <LogOut />
            Se déconnecter
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>

    <p v-if="error" class="text-sm text-destructive">{{ error }}</p>

    <RouterView />
  </main>
  <!-- Outside the main page: the wizard opens it too (« Gérer les catégories… ») -->
  <SettingsDialog v-if="user && settingsMounted" />
</template>
