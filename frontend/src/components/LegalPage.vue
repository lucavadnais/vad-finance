<script setup lang="ts">
// Layout of the public legal pages (privacy policy, terms of use): readable
// without signing in, linked from the sign-in page. The text is the default
// slot; its headings, paragraphs and lists are styled here.
import { RouterLink } from 'vue-router';
import { ChevronLeft } from '@lucide/vue';
import { LEGAL } from '@/lib/legal';

defineProps<{ title: string }>();
</script>

<template>
  <main class="mx-auto flex min-h-dvh max-w-2xl flex-col gap-8 px-4 py-6 md:py-10">
    <header class="flex items-center gap-3">
      <img src="/logo.svg" alt="" class="size-9 rounded-lg" />
      <span class="mr-auto text-lg font-semibold">{{ LEGAL.app }}</span>
      <RouterLink
        to="/"
        class="flex items-center gap-1 rounded-md text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ChevronLeft class="size-4" />
        Retour à l'application
      </RouterLink>
    </header>

    <article
      class="text-[0.95rem] leading-relaxed [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:mt-1 [&_p]:mt-3 [&_strong]:font-medium [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6"
    >
      <h1 class="text-3xl font-semibold">{{ title }}</h1>
      <p class="text-sm text-muted-foreground">Dernière mise à jour : {{ LEGAL.updated }}</p>
      <slot />
    </article>

    <footer class="mt-auto flex flex-wrap gap-x-4 gap-y-1 border-t pt-4 text-sm text-muted-foreground">
      <RouterLink to="/privacy" class="hover:text-foreground">Politique de confidentialité</RouterLink>
      <RouterLink to="/terms" class="hover:text-foreground">Conditions d'utilisation</RouterLink>
    </footer>
  </main>
</template>
