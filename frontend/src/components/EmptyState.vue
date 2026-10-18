<script setup lang="ts">
// An empty list, said in its place: an icon on a tile, a title, a line on what
// to do about it. `actionLabel`: a button adding the list's first item (`action`)
// - the list's own add button is then hidden, not to offer it twice. Other
// actions go under it (default slot), if any. The icon on a primary tile, as
// the settings' sections; the colors from the theme's tokens, so it fits a
// .surface-night card too.
import type { Component, HTMLAttributes } from 'vue';
import { Plus } from '@lucide/vue';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';

defineProps<{
  icon?: Component;
  title: string;
  description?: string;
  actionLabel?: string;
  class?: HTMLAttributes['class'];
}>();
const emit = defineEmits<{ action: [] }>();
</script>

<template>
  <Empty :class="cn('gap-4 p-6 md:p-8', $props.class)">
    <EmptyHeader>
      <EmptyMedia
        v-if="icon"
        variant="icon"
        class="bg-primary text-primary-foreground [&_svg:not([class*='size-'])]:size-5"
      >
        <component :is="icon" />
      </EmptyMedia>
      <EmptyTitle>{{ title }}</EmptyTitle>
      <EmptyDescription v-if="description">{{ description }}</EmptyDescription>
    </EmptyHeader>
    <EmptyContent v-if="actionLabel || $slots.default">
      <Button v-if="actionLabel" @click="emit('action')">
        <Plus />
        {{ actionLabel }}
      </Button>
      <slot />
    </EmptyContent>
  </Empty>
</template>
