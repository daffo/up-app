import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Localization from "expo-localization";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { supabase } from "./supabase";

const PUSH_TOKEN_KEY = "@push_token";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotifications(
  userId: string,
): Promise<void> {
  if (Platform.OS === "web" || !Device.isDevice) return;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== "granted") return;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) throw new Error("Missing EAS project ID");

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  const languageCode = Localization.getLocales()[0]?.languageCode;
  const locale = languageCode === "it" ? "it" : "en";
  const { error } = await supabase.from("push_tokens").upsert(
    {
      user_id: userId,
      token,
      locale,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,token" },
  );
  if (error) throw error;
  await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
}

export async function unregisterPushToken(userId: string): Promise<void> {
  const token = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
  if (!token) return;

  const { error } = await supabase
    .from("push_tokens")
    .delete()
    .eq("user_id", userId)
    .eq("token", token);
  if (error) throw error;
  await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
}
