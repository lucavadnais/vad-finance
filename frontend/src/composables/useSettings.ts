// The settings dialog, opened from the header or from a shortcut (e.g. "Gérer
// les catégories…" in a category picker) straight on the right section
import { ref } from 'vue';

// One per section of the dialog's side menu (Profil, Sécurité... later)
export type SettingsSection = 'categories' | 'budget';

const open = ref(false);
const section = ref<SettingsSection>('categories');

function openSettings(to: SettingsSection = 'categories') {
  section.value = to;
  open.value = true;
}

export function useSettings() {
  return { open, section, openSettings };
}
