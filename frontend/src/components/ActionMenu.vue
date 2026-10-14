<script setup lang="ts">
// A "…" menu of actions on one item, with its trigger in the default slot: the
// usual dropdown on a computer, the actions sheet (ActionSheet) on a phone.
// `labelled`: the dropdown also shows the title and description on top.
import type { SheetAction } from './ActionSheet.vue';
import { ref } from 'vue';
import { useMediaQuery } from '@vueuse/core';
import { Slot } from 'reka-ui';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ActionSheet from './ActionSheet.vue';

defineProps<{ title: string; description?: string; actions: SheetAction[]; labelled?: boolean }>();

const phone = useMediaQuery('(max-width: 639px)');
const sheetOpen = ref(false);
</script>

<template>
  <template v-if="phone">
    <Slot @click="sheetOpen = true"><slot /></Slot>
    <ActionSheet v-model:open="sheetOpen" :title="title" :description="description" :actions="actions">
      <template v-if="$slots.icon" #icon><slot name="icon" /></template>
    </ActionSheet>
  </template>
  <DropdownMenu v-else>
    <DropdownMenuTrigger as-child><slot /></DropdownMenuTrigger>
    <DropdownMenuContent align="end" :class="labelled && 'w-60'">
      <template v-if="labelled">
        <DropdownMenuLabel class="flex flex-col font-normal">
          <span class="truncate font-medium">{{ title }}</span>
          <span v-if="description" class="truncate text-xs text-muted-foreground">{{ description }}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
      </template>
      <DropdownMenuItem
        v-for="action in actions"
        :key="action.label"
        :variant="action.destructive ? 'destructive' : 'default'"
        @select="action.run()"
      >
        <component :is="action.icon" />
        {{ action.label }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
