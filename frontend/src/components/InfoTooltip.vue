<script setup lang="ts">
// A small info icon showing a note on hover or focus (shadcn Tooltip). The note
// is the default slot; `label` is read by screen readers on the icon.
import { Info } from '@lucide/vue';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

withDefaults(defineProps<{ label?: string }>(), { label: 'Plus d’informations' });
</script>

<template>
  <TooltipProvider :delay-duration="150">
    <Tooltip>
      <TooltipTrigger as-child>
        <button
          type="button"
          class="inline-flex rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          :aria-label="label"
        >
          <Info class="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent class="max-w-64">
        <slot />
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
</template>
