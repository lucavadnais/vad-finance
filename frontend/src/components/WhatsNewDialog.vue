<script setup lang="ts">
// A new feature, put forward once: shown over the app to a user who has not
// seen it yet (settings.seenAnnouncements, lib/announcements.ts), then
// remembered as seen however it is closed. "Découvrir" opens it.
import type { Component } from 'vue';
import { computed, nextTick, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Landmark, ShieldCheck, Target } from '@lucide/vue';
import { api } from '@/api';
import { useFinanceData } from '@/composables/useFinanceData';
import { ANNOUNCEMENTS } from '@/lib/announcements';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import GoalRings from './GoalRings.vue';

const { settings } = useFinanceData();
const router = useRouter();

// The first not seen yet; none until the settings are loaded
const pending = computed(() => {
  const seen = settings.value.seenAnnouncements;
  return seen ? ANNOUNCEMENTS.find((a) => !seen.includes(a)) : undefined;
});
// Closed by hand: hidden at once, even before the settings are saved
const dismissed = ref(false);
const open = computed(() => !!pending.value && !dismissed.value);

const FEATURES: { icon: Component; title: string; text: string }[] = [
  {
    icon: ShieldCheck,
    title: "Fonds d'urgence",
    text: 'Une cible calculée selon vos dépenses essentielles et votre situation.',
  },
  {
    icon: Target,
    title: 'Objectifs',
    text: "Un voyage, une mise de fonds… et ce qu'il faut mettre de côté chaque mois pour atteindre vous faire plaisir.",
  },
  {
    icon: Landmark,
    title: 'Dettes',
    text: 'Prêt étudiant, hypothèque : gardez facilement le suivi de vos dettes.',
  },
];

async function close(discover = false) {
  const key = pending.value;
  if (!key) return;
  dismissed.value = true;
  const seen = [...(settings.value.seenAnnouncements ?? []), key];
  settings.value = { ...settings.value, seenAnnouncements: seen };
  // Not saved: shown again next time, nothing more
  api.updateSettings({ seenAnnouncements: seen }).catch(() => {});
  if (!discover) return;
  // The goals' tab on a phone; their card, scrolled to, on a computer
  await router.push({ name: 'goals' });
  await nextTick();
  document.getElementById('goals')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
</script>

<template>
  <Dialog :open="open" @update:open="(value) => !value && close()">
    <DialogContent class="sm:max-w-md">
      <!-- The feature, drawn: a goal's rings filling up, on a tint bleeding to
           the dialog's edges (the sheet's on a phone, its round close button
           in the corner) -->
      <div
        class="-mx-6 -mt-6 flex shrink-0 justify-center rounded-t-3xl bg-linear-to-b from-primary/12 to-primary/0 pt-8 pb-2 sm:rounded-t-lg"
        aria-hidden="true"
      >
        <GoalRings :value="68" :left="100" :right="45" :size="150" value-class="stroke-primary">
          <Target class="size-8 text-primary" />
        </GoalRings>
      </div>

      <!-- Centered; the sheet's room for its close button not needed here -->
      <DialogHeader class="items-center text-center max-sm:pr-0">
        <span class="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">Nouveau</span>
        <DialogTitle class="text-xl">Vos objectifs d'épargne</DialogTitle>
        <DialogDescription>
          Mettez de l'argent de côté pour ce qui compte, et suivez vos prêts jusqu'au dernier paiement.
        </DialogDescription>
      </DialogHeader>

      <DialogBody>
        <ul class="flex flex-col gap-4">
          <li v-for="f in FEATURES" :key="f.title" class="flex gap-3">
            <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <component :is="f.icon" class="size-5" />
            </span>
            <span class="flex flex-col">
              <span class="text-sm font-medium">{{ f.title }}</span>
              <span class="text-sm text-muted-foreground">{{ f.text }}</span>
            </span>
          </li>
        </ul>
      </DialogBody>

      <DialogFooter>
        <Button variant="outline" @click="close()">Plus tard</Button>
        <Button @click="close(true)">Découvrir les objectifs</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
