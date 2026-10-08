<script lang="ts">
export type HomeTab = 'home' | 'spending' | 'budget' | 'analysis';
</script>

<script setup lang="ts">
// Floating tab bar at the bottom of a phone screen: one tab per card of the
// home page. Hidden from tablet up, where every card shows at once.
import type { Component } from 'vue';
import { computed, ref } from 'vue';
import { useEventListener } from '@vueuse/core';
import { ArrowLeftRight, ChartColumn, House, PiggyBank } from '@lucide/vue';

// A red dot on a tab with something to review (transfers, duplicates)
defineProps<{ alerts?: Partial<Record<HomeTab, boolean>> }>();
const tab = defineModel<HomeTab>({ required: true });

const TABS: { value: HomeTab; label: string; icon: Component }[] = [
  { value: 'home', label: 'Accueil', icon: House },
  { value: 'spending', label: 'Dépenses', icon: ArrowLeftRight },
  { value: 'budget', label: 'Budget', icon: PiggyBank },
  { value: 'analysis', label: 'Analyse', icon: ChartColumn },
];
// Out of the way while scrolling down (reading), back as soon as scrolling up
// or near the top. A few pixels of slack, so a finger's jitter does not toggle it
const hidden = ref(false);
let lastY = 0;
useEventListener(
  window,
  'scroll',
  () => {
    const y = window.scrollY;
    if (y < 80) hidden.value = false;
    else if (Math.abs(y - lastY) > 8) hidden.value = y > lastY;
    else return;
    lastY = y;
  },
  { passive: true },
);

const active = computed(() =>
  Math.max(
    0,
    TABS.findIndex((t) => t.value === tab.value),
  ),
);
</script>

<template>
  <nav
    aria-label="Sections"
    class="surface-night fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 flex rounded-full border border-white/10 bg-card/90 p-1.5 shadow-lg backdrop-blur-md transition-transform duration-300 ease-out motion-reduce:transition-none md:hidden"
    :class="hidden && 'translate-y-[calc(100%+2rem+env(safe-area-inset-bottom))]'"
  >
    <!-- The active tab's pill, one tab wide, sliding to the tab picked -->
    <span
      aria-hidden="true"
      class="absolute inset-y-1.5 left-1.5 w-[calc((100%-0.75rem)/4)] rounded-full bg-white/15 transition-transform duration-300 ease-out motion-reduce:transition-none"
      :style="{ transform: `translateX(${active * 100}%)` }"
    />
    <button
      v-for="t in TABS"
      :key="t.value"
      type="button"
      :aria-label="t.label"
      :title="t.label"
      :aria-current="tab === t.value ? 'page' : undefined"
      class="relative flex h-13 flex-1 items-center justify-center rounded-full text-muted-foreground transition-colors duration-300"
      :class="tab === t.value && 'text-card-foreground'"
      @click="tab = t.value"
    >
      <component :is="t.icon" class="size-6" :stroke-width="tab === t.value ? 2.25 : 1.75" />
      <span
        v-if="alerts?.[t.value]"
        class="absolute top-1/2 left-1/2 mt-1.5 ml-2 size-2.5 rounded-full bg-destructive ring-2 ring-card"
      />
    </button>
  </nav>
</template>
