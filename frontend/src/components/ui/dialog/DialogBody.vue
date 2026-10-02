<script setup lang="ts">
// The part of a dialog that scrolls when it is taller than the screen, between
// its header and footer (which stay in view)
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <div
    data-slot="dialog-body"
    :class="cn('-mx-6 -my-1 flex min-h-0 flex-col gap-4 overflow-y-auto px-6 py-1', props.class)"
  >
    <slot />
  </div>
</template>
