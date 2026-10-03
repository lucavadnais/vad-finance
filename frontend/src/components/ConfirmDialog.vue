<script setup lang="ts">
// Wraps a trigger (default slot) with a shadcn AlertDialog asking to confirm.
// Without a trigger, open it through v-model:open (e.g. from a menu item).
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { buttonVariants } from '@/components/ui/button';

withDefaults(defineProps<{ title: string; description?: string; confirmLabel?: string }>(), {
  confirmLabel: 'Supprimer',
});
const open = defineModel<boolean>('open', { default: false });
const emit = defineEmits<{ confirm: [] }>();
</script>

<template>
  <AlertDialog v-model:open="open">
    <AlertDialogTrigger v-if="$slots.default" as-child>
      <slot />
    </AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ title }}</AlertDialogTitle>
        <AlertDialogDescription v-if="description">{{ description }}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Annuler</AlertDialogCancel>
        <AlertDialogAction :class="buttonVariants({ variant: 'destructive' })" @click="emit('confirm')">
          {{ confirmLabel }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
