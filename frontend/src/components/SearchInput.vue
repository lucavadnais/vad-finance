<script setup lang="ts">
// A search field: a magnifier on the left, a cross clearing it on the right
// once something is typed. Escape clears it too; only once empty does it reach
// the parent (e.g. closing a dialog).
import type { HTMLAttributes } from 'vue';
import { Search, X } from '@lucide/vue';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const props = defineProps<{ placeholder?: string; label: string; class?: HTMLAttributes['class'] }>();
const search = defineModel<string>({ default: '' });

function clearOnEscape(e: KeyboardEvent) {
  if (!search.value) return;
  e.stopPropagation();
  search.value = '';
}
</script>

<template>
  <div :class="cn('relative', props.class)">
    <Search class="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
    <Input
      v-model="search"
      type="search"
      :placeholder="placeholder"
      :aria-label="label"
      class="pr-8 pl-8 [&::-webkit-search-cancel-button]:hidden"
      @keydown.esc="clearOnEscape"
    />
    <Button
      v-if="search"
      variant="ghost"
      size="icon-xs"
      class="absolute top-1/2 right-1.5 -translate-y-1/2"
      aria-label="Effacer la recherche"
      @click="search = ''"
    >
      <X />
    </Button>
  </div>
</template>
