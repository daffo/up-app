import en from "../../../locales/en.json" with { type: "json" };
import it from "../../../locales/it.json" with { type: "json" };

export type NotificationType =
  | "routeLogged"
  | "routeCommented"
  | "threadComment"
  | "sharedLog";

const templates = {
  en: en.pushNotifications,
  it: it.pushNotifications,
};

export function renderNotification(
  type: NotificationType,
  locale: "en" | "it",
  variables: Record<string, string>,
): string {
  return templates[locale][type].replace(
    /{{(\w+)}}/g,
    (_, key) => variables[key] ?? "",
  );
}

export function anonymousName(locale: "en" | "it"): string {
  return locale === "it" ? it.common.anonymous : en.common.anonymous;
}
