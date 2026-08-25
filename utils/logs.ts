import i18n from "../lib/i18n";
import { Log } from "../types/database.types";

export function getSentRating(logs: Log[]): number | null {
  const ratings = logs
    .filter((log) => log.status === "sent")
    .map((log) => log.quality_rating)
    .filter((rating): rating is number => rating !== null);

  return ratings.length
    ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
    : null;
}

export function getDifficultyLabel(rating: number | null): string | null {
  if (rating === -1) return i18n.t("log.soft");
  if (rating === 0) return i18n.t("log.accurate");
  if (rating === 1) return i18n.t("log.hard");
  return null;
}
