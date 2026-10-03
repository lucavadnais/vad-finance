<script setup lang="ts">
// The category's color, as a small dot next to its name
defineProps<{ color?: string | null }>();
</script>

<template>
  <span
    class="inline-block size-2.5 shrink-0 rounded-full"
    :class="!color && 'bg-muted-foreground/40'"
    :style="color ? { background: color } : undefined"
    aria-hidden="true"
  />
</template>
