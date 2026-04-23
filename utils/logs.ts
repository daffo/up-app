import i18n from "../lib/i18n";

export function getDifficultyLabel(rating: number | null): string | null {
  if (rating === -1) return i18n.t("log.soft");
  if (rating === 0) return i18n.t("log.accurate");
  if (rating === 1) return i18n.t("log.hard");
  return null;
}
