import i18n from '../lib/i18n';

/**
 * Format date as absolute date string using device locale
 */
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString(i18n.language);
}

/**
 * Format date as relative time, becoming absolute after 2 days
 * - < 1 min: "Just now"
 * - < 1 hour: "Xm ago"
 * - < 24 hours: "Xh ago"
 * - < 2 days: "Yesterday"
 * - >= 2 days: absolute date
 */
export function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return i18n.t('date.justNow');
  if (diffMins < 60) return i18n.t('date.minutesAgo', { count: diffMins });
  if (diffHours < 24) return i18n.t('date.hoursAgo', { count: diffHours });
  if (diffDays < 2) return i18n.t('date.yesterday');
  return date.toLocaleDateString(i18n.language);
}
