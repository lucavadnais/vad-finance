// Text compared ignoring accents, case and surrounding spaces: "electricite"
// matches " Électricité"
export const normalizeText = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
