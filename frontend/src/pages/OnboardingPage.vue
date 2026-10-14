<script setup lang="ts">
// Setup wizard, shown instead of the app to a user who has not finished or
// skipped it (settings.onboardingDone, see App.vue): a welcome, then their
// accounts, categories, budget and a first import, one step at a time. Each
// step saves as it goes, so leaving halfway keeps what was done; the wizard
// comes back at the next visit until "Terminer" or "Passer la configuration".
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ChevronLeft, Landmark, PiggyBank, Tags, Upload } from '@lucide/vue';
import { api } from '@/api';
import { useAuth } from '@/composables/useAuth';
import { useFinanceData } from '@/composables/useFinanceData';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import AccountsStep from '@/components/onboarding/AccountsStep.vue';
import BudgetStep from '@/components/onboarding/BudgetStep.vue';
import CategoriesStep from '@/components/onboarding/CategoriesStep.vue';
import CsvImport from '@/components/CsvImport.vue';

const { user } = useAuth();
const { accounts, categories, settings, refresh } = useFinanceData();
const router = useRouter();

const STEPS = [
  {
    key: 'accounts',
    label: 'Comptes',
    icon: Landmark,
    title: 'Vos comptes',
    description: 'Les comptes bancaires que vous voulez suivre : chèque, épargne, carte de crédit...',
  },
  {
    key: 'categories',
    label: 'Catégories',
    icon: Tags,
    title: 'Vos catégories',
    description:
      "Pour classer vos transactions et voir où va votre argent. Utilisez des groupes pour avoir une meilleure vue d'ensemble de vos finances.",
  },
  {
    key: 'budget',
    label: 'Budget',
    icon: PiggyBank,
    title: 'Votre budget',
    description: 'Ce que vous prévoyez recevoir et dépenser, pour suivre le mois en cours.',
  },
  {
    key: 'import',
    label: 'Import',
    icon: Upload,
    title: 'Vos premières transactions',
    description: 'Importez un relevé CSV de votre banque, ou saisissez une transaction à la main. Facultatif.',
  },
] as const;

// -1: the welcome, before the steps
const index = ref(-1);
const step = computed(() => (index.value >= 0 ? STEPS[index.value] : null));
const last = computed(() => index.value === STEPS.length - 1);
watch(index, () => window.scrollTo({ top: 0 }));

// The current step's component, when it saves on "Suivant"
const current = ref<{ submit: () => Promise<boolean> } | null>(null);
const busy = ref(false);
const error = ref('');

async function finish() {
  busy.value = true;
  error.value = '';
  try {
    settings.value = await api.updateSettings({ onboardingDone: true });
    router.push({ name: 'home' });
  } catch (err) {
    error.value = (err as Error).message;
  } finally {
    busy.value = false;
  }
}

async function next() {
  busy.value = true;
  try {
    if (current.value && !(await current.value.submit())) return;
  } finally {
    busy.value = false;
  }
  if (last.value) await finish();
  else index.value++;
}

const firstName = computed(() => user.value?.name.split(' ')[0] ?? '');
</script>

<template>
  <main class="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 px-4 py-6 md:py-10">
    <header class="flex items-center gap-3">
      <img src="/logo.svg" alt="" class="size-9 rounded-lg" />
      <span class="mr-auto text-lg font-semibold">VAD finances</span>
      <Button variant="ghost" size="sm" class="text-muted-foreground" :disabled="busy" @click="finish">
        Passer la configuration
      </Button>
    </header>

    <!-- Welcome -->
    <section v-if="!step" class="flex flex-1 flex-col justify-center gap-8 py-6">
      <div class="flex flex-col gap-2">
        <h1 class="text-3xl font-semibold md:text-4xl">Bienvenue{{ firstName ? `, ${firstName}` : '' }} !</h1>
        <p class="text-muted-foreground">
          Prenons quelques instants pour configurer l'application à votre goût. Je vous conseille de prévoir une
          quinzaine de minutes. Une fois l'application configurée, vous serez en mesure de profiter pleinement de toutes
          ses fonctionnalités.
          <br /><br />
          En espérant que cette application vous sera aussi utile qu'elle l'est pour moi.
          <br /><br />
          Luca
        </p>
      </div>
      <Button size="lg" class="self-start" @click="index = 0">Commencer</Button>
    </section>

    <template v-else>
      <!-- Where we are: the steps' names on a computer, a bar on a phone -->
      <nav aria-label="Étapes de la configuration">
        <ol class="flex gap-2 max-sm:hidden">
          <li v-for="(s, i) in STEPS" :key="s.key" class="flex flex-1 flex-col gap-2">
            <span :class="cn('h-1 rounded-full', i <= index ? 'bg-primary' : 'bg-muted')" />
            <span
              :class="cn('text-sm', i === index ? 'font-medium' : 'text-muted-foreground')"
              :aria-current="i === index ? 'step' : undefined"
            >
              {{ i + 1 }}. {{ s.label }}
            </span>
          </li>
        </ol>
        <div class="flex flex-col gap-2 sm:hidden">
          <span class="text-sm text-muted-foreground">Étape {{ index + 1 }} sur {{ STEPS.length }}</span>
          <Progress :model-value="((index + 1) / STEPS.length) * 100" />
        </div>
      </nav>

      <section class="flex flex-1 flex-col gap-6">
        <div class="flex flex-col gap-1">
          <h1 class="text-2xl font-semibold">{{ step.title }}</h1>
          <p class="text-muted-foreground">{{ step.description }}</p>
        </div>

        <AccountsStep v-if="step.key === 'accounts'" ref="current" />
        <CategoriesStep v-else-if="step.key === 'categories'" ref="current" />
        <BudgetStep v-else-if="step.key === 'budget'" ref="current" />
        <CsvImport
          v-else
          :accounts="accounts"
          :categories="categories"
          @imported="refresh"
          @created="refresh"
          @error="error = $event"
        />
      </section>

      <p v-if="error" class="text-sm text-destructive">{{ error }}</p>

      <!-- Stuck to the bottom of the screen, so "Suivant" is always at hand -->
      <footer
        class="sticky bottom-0 -mx-4 flex items-center gap-2 border-t bg-background/90 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur"
      >
        <Button variant="ghost" :disabled="busy" @click="index--">
          <ChevronLeft />
          Précédent
        </Button>
        <!-- A step left empty saves nothing: "Suivant" is also how to skip it -->
        <Button class="ml-auto" :disabled="busy" @click="next">
          {{ busy ? 'Enregistrement…' : last ? 'Terminer' : 'Suivant' }}
        </Button>
      </footer>
    </template>
  </main>
</template>
