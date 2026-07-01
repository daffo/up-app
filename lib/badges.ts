import type { BadgeKey } from "../types/database.types";

// Badge presentation — icon glyph + accent color per badge.
//
// Art is swappable: upgrading a badge to a custom SVG/PNG later means changing
// one entry here, no schema change or migration. Names + descriptions live in
// i18n (`badges.<key>.name` / `badges.<key>.desc`), not here.
//
// Colors are fixed hex (badges read as colorful in both light and dark themes).
// The locked/greyed state is applied by the renderer using a theme token.

export type BadgeIconSet = "ionicons" | "material-community" | "emoji";

export interface BadgePresentation {
  iconSet: BadgeIconSet;
  icon: string;
  color: string;
}

export const BADGE_PRESENTATION: Record<BadgeKey, BadgePresentation> = {
  first_send: {
    iconSet: "material-community",
    icon: "sprout",
    color: "#28a745",
  },
  sends_10: {
    iconSet: "emoji",
    icon: "🐒",
    color: "#a0522d",
  },
  sends_25: {
    iconSet: "emoji",
    icon: "🐵",
    color: "#8b5a2b",
  },
  sends_50: {
    iconSet: "emoji",
    icon: "🦧",
    color: "#b8651b",
  },
  sends_100: {
    iconSet: "emoji",
    icon: "🦍",
    color: "#4a4a4a",
  },
  grade_5: {
    iconSet: "material-community",
    icon: "grain",
    color: "#c2a878",
  },
  grade_6: {
    iconSet: "material-community",
    icon: "hiking",
    color: "#1f8a4c",
  },
  grade_7: {
    iconSet: "material-community",
    icon: "summit",
    color: "#c9a227",
  },
  grade_8: {
    iconSet: "material-community",
    icon: "diamond-stone",
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
    icon: "ruler-square-compass",
    color: "#0353a4",
  },
  sadist: {
    iconSet: "material-community",
    icon: "emoticon-devil",
    color: "#c0392b",
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
