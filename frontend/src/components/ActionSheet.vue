<script setup lang="ts">
// A phone's menu of actions on one item: its name (and an icon, in the `icon`
// slot) on top, then one row per action. The sheet closes before the action runs.
import type { Component } from 'vue';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export interface SheetAction {
  label: string;
  icon: Component;
  destructive?: boolean;
  run: () => void;
}

const open = defineModel<boolean>('open', { required: true });
defineProps<{ title: string; description?: string; actions: SheetAction[] }>();

function select(action: SheetAction) {
  open.value = false;
  action.run();
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="gap-2">
      <DialogHeader class="flex-row items-center gap-3">
        <span
          v-if="$slots.icon"
          class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted [&_svg]:size-5"
        >
          <slot name="icon" />
        </span>
        <div class="flex min-w-0 flex-col gap-1">
          <DialogTitle class="truncate leading-tight">{{ title }}</DialogTitle>
          <DialogDescription :class="!description && 'sr-only'">{{ description ?? 'Actions' }}</DialogDescription>
        </div>
      </DialogHeader>

      <div class="-mx-6 flex flex-col border-t pt-2">
        <button
          v-for="action in actions"
          :key="action.label"
          type="button"
          class="flex items-center gap-4 px-6 py-3.5 text-left text-base outline-none active:bg-muted focus-visible:bg-muted [&_svg]:size-5 [&_svg]:shrink-0"
          :class="action.destructive && 'text-destructive'"
          @click="select(action)"
        >
          <component :is="action.icon" />
          {{ action.label }}
        </button>
      </div>
    </DialogContent>
  </Dialog>
</template>
