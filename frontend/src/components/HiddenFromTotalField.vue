<script setup lang="ts">
// "Masquer du total des comptes" of a goal saved in the app (the emergency
// fund, a savings goal without an account: an account has its own option):
// what it holds is left out of the total of the accounts and its curve
// (lib/savings.ts). v-model: on or off.
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

const hidden = defineModel<boolean>({ required: true });
defineProps<{ id: string }>();
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-center gap-2">
      <Switch :id="id" v-model="hidden" />
      <Label :for="id">Masquer du total des comptes</Label>
    </div>
    <p class="text-sm text-muted-foreground">
      Ce qui est mis de côté ici n'apparaît plus dans le total de vos comptes ni dans sa courbe.
    </p>
  </div>
</template>
