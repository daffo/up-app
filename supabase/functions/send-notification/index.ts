import { createClient } from "@supabase/supabase-js";
import {
  anonymousName,
  renderNotification,
  type NotificationType,
} from "./locales.ts";

type WebhookPayload = {
  type: "INSERT" | "UPDATE";
  table: "logs" | "comments";
  record: { id: string; user_id: string; route_id: string; status?: string };
  old_record: { status?: string } | null;
};

type PreferenceKey =
  | "route_logged"
  | "route_commented"
  | "thread_comment"
  | "shared_log";

type Recipient = { userId: string; preference: PreferenceKey; type: NotificationType };
type PushMessage = {
  to: string;
  body: string;
  data: { routeId: string; type: PreferenceKey };
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const payload = (await request.json()) as WebhookPayload;
  const actorId = payload.record.user_id;
  const routeId = payload.record.route_id;

  if (
    payload.table === "logs" &&
    (payload.record.status !== "sent" ||
      (payload.type === "UPDATE" && payload.old_record?.status === "sent"))
  ) {
    return Response.json({ sent: 0 });
  }

  const [{ data: route, error: routeError }, { data: actor }] = await Promise.all([
    supabase.from("routes").select("title, user_id").eq("id", routeId).single(),
    supabase.from("user_profiles").select("display_name").eq("user_id", actorId).maybeSingle(),
  ]);
  if (routeError) throw routeError;

  const recipients: Recipient[] = [];
  if (payload.table === "logs") {
    recipients.push({
      userId: route.user_id,
      preference: "route_logged",
      type: "routeLogged",
    });
    const { data: logs, error } = await supabase
      .from("logs")
      .select("user_id")
      .eq("route_id", routeId)
      .eq("status", "sent")
      .neq("user_id", actorId)
      .neq("user_id", route.user_id);
    if (error) throw error;
    for (const log of logs ?? []) {
      recipients.push({
        userId: log.user_id,
        preference: "shared_log",
        type: "sharedLog",
      });
    }
  } else {
    recipients.push({
      userId: route.user_id,
      preference: "route_commented",
      type: "routeCommented",
    });
    const { data: comments, error } = await supabase
      .from("comments")
      .select("user_id")
      .eq("route_id", routeId)
      .neq("user_id", actorId)
      .neq("user_id", route.user_id);
    if (error) throw error;
    for (const comment of comments ?? []) {
      recipients.push({
        userId: comment.user_id,
        preference: "thread_comment",
        type: "threadComment",
      });
    }
  }

  const uniqueRecipients = [...new Map(
    recipients
      .filter(({ userId }) => userId !== actorId)
      .map((recipient) => [`${recipient.userId}:${recipient.type}`, recipient]),
  ).values()];
  const userIds = [...new Set(uniqueRecipients.map(({ userId }) => userId))];
  if (userIds.length === 0) return Response.json({ sent: 0 });

  const [{ data: preferences, error: preferencesError }, { data: tokens, error: tokensError }] =
    await Promise.all([
      supabase.from("notification_preferences").select("*").in("user_id", userIds),
      supabase.from("push_tokens").select("user_id, token, locale").in("user_id", userIds),
    ]);
  if (preferencesError) throw preferencesError;
  if (tokensError) throw tokensError;

  const preferenceByUser = new Map((preferences ?? []).map((row) => [row.user_id, row]));
  const recipientsByUser = new Map<string, Recipient[]>();
  for (const recipient of uniqueRecipients) {
    recipientsByUser.set(recipient.userId, [
      ...(recipientsByUser.get(recipient.userId) ?? []),
      recipient,
    ]);
  }
  const messages: PushMessage[] = (tokens ?? []).flatMap((token) =>
    (recipientsByUser.get(token.user_id) ?? []).flatMap((recipient) => {
      if (preferenceByUser.get(token.user_id)?.[recipient.preference] === false) return [];
      return [{
        to: token.token,
        body: renderNotification(recipient.type, token.locale, {
          displayName: actor?.display_name || anonymousName(token.locale),
          title: route.title,
        }),
        data: { routeId, type: recipient.preference },
      }];
    }),
  );
  if (messages.length === 0) return Response.json({ sent: 0 });

  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(messages),
  });
  if (!response.ok) throw new Error(`Expo push failed: ${response.status}`);

  const result = await response.json();
  const tickets = Array.isArray(result.data) ? result.data : [result.data];
  const staleTokens = tickets.flatMap((ticket: { details?: { error?: string } }, index: number) =>
    ticket.details?.error === "DeviceNotRegistered" ? [messages[index].to] : [],
  );
  if (staleTokens.length > 0) {
    await supabase.from("push_tokens").delete().in("token", staleTokens);
  }

  return Response.json({ sent: messages.length });
});
