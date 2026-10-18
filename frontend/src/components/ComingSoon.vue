<script setup lang="ts">
// A feature to come, announced where it will live: its icon, its name, what
// it will do, and a "Bientôt" badge. Not clickable.
import type { Component } from 'vue';
import { Badge } from '@/components/ui/badge';

defineProps<{ icon: Component; title: string; description: string }>();
</script>

<template>
  <div
    class="flex items-center gap-3 rounded-lg border-2 border-dashed border-muted-foreground/30 p-4 text-sm"
    aria-disabled="true"
  >
    <component :is="icon" class="size-5 shrink-0 text-muted-foreground" />
    <span class="flex min-w-0 flex-col">
      <span class="font-medium">{{ title }}</span>
      <span class="text-muted-foreground">{{ description }}</span>
    </span>
    <Badge variant="secondary" class="ml-auto shrink-0">Bientôt</Badge>
  </div>
</template>
