import type { BadgeKey } from "../types/database.types";

// Badge presentation — icon glyph + accent color per badge.
//
// Art is swappable: upgrading a badge to a custom SVG/PNG later means changing
// one entry here, no schema change or migration. Names + descriptions live in
// i18n (`badges.<key>.name` / `badges.<key>.desc`), not here.
//
// Colors are fixed hex (badges read as colorful in both light and dark themes).
// The locked/greyed state is applied by the renderer using a theme token.

export type BadgeIconSet = "ionicons" | "material-community";

export interface BadgePresentation {
  iconSet: BadgeIconSet;
  icon: string;
  color: string;
}

export const BADGE_PRESENTATION: Record<BadgeKey, BadgePresentation> = {
  first_send: {
    iconSet: "ionicons",
    icon: "checkmark-circle",
    color: "#28a745",
  },
  sends_10: {
    iconSet: "material-community",
    icon: "numeric-10-circle",
    color: "#2e9e5b",
  },
  sends_25: {
    iconSet: "material-community",
    icon: "numeric-9-plus-circle",
    color: "#1f8a4c",
  },
  sends_50: {
    iconSet: "material-community",
    icon: "medal",
    color: "#c9a227",
  },
  sends_100: {
    iconSet: "material-community",
    icon: "trophy",
    color: "#d4af37",
  },
  first_attempt: {
    iconSet: "material-community",
    icon: "arm-flex",
    color: "#e67e22",
  },
  comeback: {
    iconSet: "material-community",
    icon: "rocket-launch",
    color: "#8e44ad",
  },
  first_route: {
    iconSet: "material-community",
    icon: "map-marker-path",
    color: "#0066cc",
  },
  routes_10: {
    iconSet: "material-community",
    icon: "map-legend",
    color: "#0353a4",
  },
  first_comment: {
    iconSet: "ionicons",
    icon: "chatbubble-ellipses",
    color: "#16a3a3",
  },
  route_sent_by_other: {
    iconSet: "material-community",
    icon: "account-heart",
    color: "#e84393",
  },
};
