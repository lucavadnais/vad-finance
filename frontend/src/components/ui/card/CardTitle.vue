<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <h3
    data-slot="card-title"
    :class="cn('col-start-1 leading-none font-semibold', props.class)"
  >
    <slot />
  </h3>
</template>
