<script setup lang="ts">
// A wizard step's title, and under it a line on what to do (WizardFrame on
// top of the step, or a step within it, e.g. a debt's payment under its name)
defineProps<{ title: string; description?: string }>();
</script>

<template>
  <div class="flex flex-col gap-1">
    <h4 class="text-sm font-medium">{{ title }}</h4>
    <p v-if="description" class="text-sm text-muted-foreground">{{ description }}</p>
  </div>
</template>
