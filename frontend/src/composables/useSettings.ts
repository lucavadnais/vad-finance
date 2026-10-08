// The settings dialog, opened from the header or from a shortcut (e.g. "Gérer
// les catégories…" in a category picker) straight on the right section
import { ref } from 'vue';

// One per section of the dialog's side menu (Profil, Sécurité... later)
export type SettingsSection = 'categories' | 'budget' | 'display';

const open = ref(false);
const section = ref<SettingsSection>('categories');
// Opened straight on a section (a shortcut), not from the header: on a phone,
// that section shows rather than the list of them
const direct = ref(false);

function openSettings(to?: SettingsSection) {
  section.value = to ?? 'categories';
  direct.value = to !== undefined;
  open.value = true;
}

export function useSettings() {
  return { open, section, direct, openSettings };
}
