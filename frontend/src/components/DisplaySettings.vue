<script setup lang="ts">
// "Affichage" section of the settings: how the charts look. A switch applies
// at once (no save button): the charts change behind the dialog, and the
// switch goes back if the save fails.
import { api } from '@/api';
import { useFinanceData } from '@/composables/useFinanceData';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

const emit = defineEmits<{ error: [message: string] }>();

const { settings } = useFinanceData();

async function setChartAxes(on: boolean) {
  settings.value = { ...settings.value, chartAxes: on };
  try {
    settings.value = await api.updateSettings({ chartAxes: on });
  } catch (err) {
    settings.value = { ...settings.value, chartAxes: !on };
    emit('error', (err as Error).message);
  }
}
</script>

<template>
  <!-- A section of the settings dialog -->
  <section class="flex flex-col gap-6">
    <header class="flex flex-col gap-1 pr-6">
      <h2 class="text-lg font-semibold">Affichage</h2>
      <p class="text-sm text-muted-foreground">L'allure des graphiques de l'application.</p>
    </header>

    <div class="flex max-w-lg items-start gap-3">
      <Switch id="chart-axes" :model-value="settings.chartAxes !== false" @update:model-value="setChartAxes" />
      <div class="flex flex-col gap-1">
        <Label for="chart-axes">Afficher les axes des graphiques</Label>
        <p class="text-sm text-muted-foreground">
          Les montants à gauche et les dates de début et de fin. Sans eux, les courbes vont d'un bord à l'autre; le
          survol (ou le toucher) montre toujours les valeurs.
        </p>
      </div>
    </div>
  </section>
</template>
