<script setup lang="ts">
// "Paramètres": a large dialog with a side menu, one section per subject
// (categories and groups, budget); user profile and security will join it.
import type { Component } from 'vue';
import type { SettingsSection } from '@/composables/useSettings';
import { ref, watch } from 'vue';
import { PiggyBank, Tags } from '@lucide/vue';
import { useFinanceData } from '@/composables/useFinanceData';
import { useSettings } from '@/composables/useSettings';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import BudgetSettings from './BudgetSettings.vue';
import CategoryManager from './CategoryManager.vue';

const { open, section } = useSettings();
const { categories, categoryGroups, refresh } = useFinanceData();

const SECTIONS: { key: SettingsSection; label: string; icon: Component }[] = [
  { key: 'categories', label: 'Catégories et groupes', icon: Tags },
  { key: 'budget', label: 'Budget', icon: PiggyBank },
];

// Errors show inside the dialog: the page's banner is hidden behind it
const error = ref('');
watch([open, section], () => (error.value = ''));
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="h-[min(52rem,calc(100dvh-2rem))] gap-0 p-0 sm:max-w-5xl sm:flex-row">
      <!-- Side menu: a row of tabs on a phone -->
      <nav
        class="flex shrink-0 flex-col gap-1 border-b p-4 sm:w-56 sm:border-r sm:border-b-0"
        aria-label="Sections des paramètres"
      >
        <DialogTitle class="px-2 pb-2 text-lg">Paramètres</DialogTitle>
        <DialogDescription class="sr-only">Réglages de l'application, par section.</DialogDescription>
        <div class="flex gap-1 overflow-x-auto sm:flex-col">
          <button
            v-for="s in SECTIONS"
            :key="s.key"
            type="button"
            :aria-current="section === s.key ? 'page' : undefined"
            :class="
              cn(
                'flex shrink-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50',
                section === s.key && 'bg-muted font-medium',
              )
            "
            @click="section = s.key"
          >
            <component :is="s.icon" class="size-4" />
            {{ s.label }}
          </button>
        </div>
      </nav>

      <!-- Each section scrolls its own list, under its fixed title and actions -->
      <div class="flex min-h-0 min-w-0 flex-1 flex-col gap-4 p-6">
        <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
        <CategoryManager
          v-if="section === 'categories'"
          :categories="categories"
          :groups="categoryGroups"
          @changed="refresh"
          @error="error = $event"
        />
        <BudgetSettings v-else-if="section === 'budget'" @error="error = $event" />
      </div>
    </DialogContent>
  </Dialog>
</template>
