<script setup lang="ts">
// The monthly buffer for unplanned spending, as typed ("25,50"), with its
// label and explanation. The default slot goes beside the field (a save
// button). In the budget settings and the setup wizard.
import { ShieldCheck } from '@lucide/vue';
import { BUFFER_COLOR } from '@/lib/colors';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const amount = defineModel<string>({ required: true });
defineProps<{ id: string }>();
</script>

<template>
  <div class="flex max-w-lg flex-col gap-2">
    <!-- The shield and color of the buffer's card in the budget -->
    <Label :for="id">
      <ShieldCheck class="size-4" :style="{ color: BUFFER_COLOR }" />
      Marge mensuelle pour imprévus
    </Label>
    <p class="text-sm text-muted-foreground">
      Parce que des petites dépenses imprévues peuvent s'accumuler rapidement, il est utile de prévoir une marge chaque
      mois.
    </p>
    <div class="flex gap-2">
      <div class="relative w-40">
        <Input :id="id" v-model="amount" inputmode="decimal" placeholder="0" class="pr-7 text-right" />
        <span class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground"
          >$</span
        >
      </div>
      <slot />
    </div>
  </div>
</template>
