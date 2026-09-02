import { useEffect } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { useAuth } from "../lib/auth-context";
import { registerForPushNotifications } from "../lib/notifications";
import { RootStackParamList } from "../navigation/types";
import type { NavigationContainerRef } from "@react-navigation/native";

export function usePushNotifications(
  navigationRef: React.RefObject<NavigationContainerRef<RootStackParamList> | null>,
) {
  const { user } = useAuth();

  useEffect(() => {
    if (!user || Platform.OS === "web") return;

    registerForPushNotifications(user.id).catch((error) => {
      console.error("Failed to register push notifications:", error);
    });

    const openRoute = (response: Notifications.NotificationResponse) => {
      const routeId = response.notification.request.content.data?.routeId;
      if (typeof routeId === "string") {
        navigationRef.current?.navigate("RouteDetail", { routeId });
      }
    };

    const lastResponse = Notifications.getLastNotificationResponse();
    if (lastResponse) {
      openRoute(lastResponse);
      Notifications.clearLastNotificationResponse();
    }

    const subscription =
      Notifications.addNotificationResponseReceivedListener(openRoute);
    return () => subscription.remove();
  }, [user?.id, navigationRef]);
}
