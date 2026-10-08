<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
  // View options (chart toggles) that don't fit beside the title in a narrow
  // header (mobile) go below it instead. Without it, actions stay top right.
  stack?: boolean
}>()
</script>

<template>
  <div
    data-slot="card-action"
    :class="cn(
      'col-start-2 row-span-2 row-start-1 self-start justify-self-end',
      stack && '@max-md/card-header:col-span-2 @max-md/card-header:col-start-1 @max-md/card-header:row-span-1 @max-md/card-header:row-start-3 @max-md/card-header:justify-self-start',
      props.class,
    )"
  >
    <slot />
  </div>
</template>
