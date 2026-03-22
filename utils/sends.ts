import i18n from '../lib/i18n';

/**
 * Get localized difficulty label for a send rating.
 */
export function getDifficultyLabel(rating: number | null): string | null {
  if (rating === -1) return i18n.t('sends.soft');
  if (rating === 0) return i18n.t('sends.accurate');
  if (rating === 1) return i18n.t('sends.hard');
  return null;
}
