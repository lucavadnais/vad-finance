<script setup lang="ts">
// "Paramètres": a large dialog with a side menu, one section per subject
// (categories and groups, budget, display); user profile and security will
// join it. On a phone, like a phone's settings: full screen, the list of the
// sections first, each one opening over it with a way back to the list.
import type { Component } from 'vue';
import type { SettingsSection } from '@/composables/useSettings';
import { ref, watch } from 'vue';
import { ChartLine, ChevronLeft, ChevronRight, PiggyBank, Tags } from '@lucide/vue';
import { useFinanceData } from '@/composables/useFinanceData';
import { useSettings } from '@/composables/useSettings';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import BudgetSettings from './BudgetSettings.vue';
import CategoryManager from './CategoryManager.vue';
import DisplaySettings from './DisplaySettings.vue';

const { open, section, direct } = useSettings();

// Phone: a section is open (else the list shows). A shortcut opens its
// section straight away; the header's button, the list.
const inSection = ref(false);
watch(open, (o) => {
  if (o) inSection.value = direct.value;
});
function pick(key: SettingsSection) {
  section.value = key;
  inSection.value = true;
}
const { categories, categoryGroups, refresh } = useFinanceData();

const SECTIONS: { key: SettingsSection; label: string; icon: Component }[] = [
  { key: 'categories', label: 'Catégories et groupes', icon: Tags },
  { key: 'budget', label: 'Budget', icon: PiggyBank },
  { key: 'display', label: 'Affichage', icon: ChartLine },
];

// Errors show inside the dialog: the page's banner is hidden behind it
const error = ref('');
watch([open, section], () => (error.value = ''));
</script>

<template>
  <Dialog v-model:open="open">
    <!-- Phone: full screen, like a phone's settings -->
    <DialogContent
      class="h-[min(52rem,calc(100dvh-2rem))] gap-0 p-0 max-md:inset-0 max-md:h-dvh max-md:max-h-dvh max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-none max-md:border-0 sm:max-w-none md:max-w-5xl md:flex-row"
    >
      <!-- The sections: a side menu on a computer; the list on a phone, hidden
           while one of them is open -->
      <nav
        class="flex shrink-0 flex-col gap-1 p-4 max-md:gap-4 max-md:overflow-y-auto max-md:pt-6 md:w-56 md:border-r"
        :class="inSection && 'max-md:hidden'"
        aria-label="Sections des paramètres"
      >
        <DialogTitle class="px-2 pb-2 text-lg max-md:text-2xl">Paramètres</DialogTitle>
        <DialogDescription class="sr-only">Réglages de l'application, par section.</DialogDescription>
        <!-- Computer: the side menu -->
        <div class="flex flex-col gap-1 max-md:hidden">
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
        <!-- Phone: one row per section, its icon on a tile, an arrow to open it -->
        <div class="flex flex-col divide-y overflow-hidden rounded-xl border bg-card md:hidden">
          <button
            v-for="s in SECTIONS"
            :key="s.key"
            type="button"
            class="flex items-center gap-3 px-4 py-3 text-left outline-none active:bg-muted focus-visible:bg-muted"
            @click="pick(s.key)"
          >
            <span
              class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"
            >
              <component :is="s.icon" class="size-4" />
            </span>
            <span class="font-medium">{{ s.label }}</span>
            <ChevronRight class="ml-auto size-4 text-muted-foreground" />
          </button>
        </div>
      </nav>

      <!-- Each section scrolls its own list, under its fixed title and actions.
           Phone: only once one is picked, with the way back to the list -->
      <div class="flex min-h-0 min-w-0 flex-1 flex-col gap-4 p-6" :class="!inSection && 'max-md:hidden'">
        <Button variant="ghost" size="sm" class="-ml-2 self-start md:hidden" @click="inSection = false">
          <ChevronLeft />
          Paramètres
        </Button>
        <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
        <CategoryManager
          v-if="section === 'categories'"
          :categories="categories"
          :groups="categoryGroups"
          @changed="refresh"
          @error="error = $event"
        />
        <BudgetSettings v-else-if="section === 'budget'" @error="error = $event" />
        <DisplaySettings v-else-if="section === 'display'" @error="error = $event" />
      </div>
    </DialogContent>
  </Dialog>
</template>
