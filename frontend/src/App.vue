<script setup lang="ts">
import { onMounted } from 'vue';
import { RouterLink, RouterView } from 'vue-router';
import { useFinanceData } from '@/composables/useFinanceData';
import { buttonVariants } from '@/components/ui/button';

const { error, refresh } = useFinanceData();

onMounted(refresh);

const NAV = [
  { to: '/', label: 'Accueil' },
  { to: '/categories', label: 'Catégories' },
];
</script>

<template>
  <main class="mx-auto flex max-w-screen-2xl flex-col gap-6 px-4 py-8 md:px-6 xl:px-8">
    <header class="flex flex-wrap items-center gap-4">
      <h1 class="mr-auto text-3xl font-semibold">Mes finances</h1>
      <nav class="flex gap-1" aria-label="Menu principal">
        <RouterLink
          v-for="item in NAV"
          :key="item.to"
          v-slot="{ href, navigate, isExactActive }"
          :to="item.to"
          custom
        >
          <a
            :href="href"
            :aria-current="isExactActive ? 'page' : undefined"
            :class="buttonVariants({ variant: isExactActive ? 'secondary' : 'ghost' })"
            @click="navigate"
          >
            {{ item.label }}
          </a>
        </RouterLink>
      </nav>
    </header>

    <p v-if="error" class="text-sm text-destructive">{{ error }}</p>

    <RouterView />
  </main>
</template>
