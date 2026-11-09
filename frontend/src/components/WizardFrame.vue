<script setup lang="ts">
// A wizard in a dialog, the same everywhere (the emergency fund's "Votre
// cible", a new goal): a frame (bordered by its class where needed) with its
// stepper (WizardSteps), the
// current step's title, the step itself (default slot), its error, then the
// buttons, right-aligned like every dialog's ("Annuler" is the dialog's, in
// its footer under the wizard): "Retour" once past the first step, then "Suivant" (emits `next`, the parent
// checks the step and moves on) or, on the last step, a submit button
// labelled `submitLabel` (none without one: the dialog saves elsewhere).
// `choice`: the first step is a choice that moves on by itself - no stepper
// and no "Retour" / "Suivant" on it. On a computer, given a max height (a
// class), the step scrolls between the stepper and the buttons; a phone
// scrolls its sheet only.
import { computed } from 'vue';
import { ChevronLeft, ChevronRight } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import StepTitle from './StepTitle.vue';
import WizardSteps from './WizardSteps.vue';

const index = defineModel<number>({ required: true });
const props = defineProps<{
  steps: string[];
  // None: the step shows its own (StepTitle)
  title?: string;
  // Under the title, a line on what to do
  description?: string;
  choice?: boolean;
  error?: string;
  submitLabel?: string;
  saving?: boolean;
  // The step is incomplete: "Suivant" (or the submit button) waits for it
  blocked?: boolean;
}>();
const emit = defineEmits<{ next: [] }>();

const onChoice = computed(() => props.choice && index.value === 0);
const last = computed(() => index.value === props.steps.length - 1);
const hasButtons = computed(() => !onChoice.value && (index.value > 0 || !last.value || !!props.submitLabel));
</script>

<template>
  <section class="flex flex-col gap-4 md:min-h-0">
    <!-- Around the step, nothing shrinks: only the step scrolls -->
    <WizardSteps v-model="index" class="shrink-0" :steps="steps" :choice="choice" />
    <StepTitle v-if="title" class="shrink-0" :title="title" :description="description" />

    <!-- The step, scrolling when the frame is given a max height: the
         stepper and the buttons stay in sight. Its parts keep their height
         (a list would shrink to nothing) -->
    <div class="-mx-1 flex flex-col gap-4 px-1 *:shrink-0 md:min-h-0 md:overflow-y-auto">
      <slot />
      <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
    </div>

    <!-- Phone: stuck to the bottom of the sheet while the wizard scrolls by -->
    <div
      v-if="hasButtons"
      class="flex shrink-0 justify-end gap-2 max-md:sticky max-md:-bottom-1 max-md:z-10 max-md:bg-background max-md:py-3"
    >
      <template v-if="!onChoice">
        <Button v-if="index > 0" type="button" variant="outline" @click="index--">
          <ChevronLeft />
          Retour
        </Button>
        <Button v-if="!last" type="button" :disabled="blocked" @click="emit('next')">
          Suivant
          <ChevronRight />
        </Button>
        <Button v-else-if="submitLabel" type="submit" :disabled="saving || blocked">{{ submitLabel }}</Button>
      </template>
    </div>
  </section>
</template>
