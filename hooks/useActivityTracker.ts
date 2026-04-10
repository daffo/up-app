import { useEffect, useRef } from "react";
import { Platform, AppState } from "react-native";
import Constants from "expo-constants";
import { userActivityApi } from "../lib/api";
import { useAuth } from "../lib/auth-context";

export function useActivityTracker() {
  const { user } = useAuth();
  const appStateRef = useRef(AppState.currentState);
  const foregroundTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (Platform.OS === "web" || !user) return;

    appStateRef.current = AppState.currentState;

    const platform = Platform.OS as "android" | "ios";
    const appVersion = Constants.expoConfig?.version ?? "unknown";
    const osVersion = Platform.Version?.toString() ?? null;

    const track = () => {
      userActivityApi
        .upsert({
          user_id: user.id,
          platform,
          app_version: appVersion,
          os_version: osVersion,
        })
        .catch(() => {}); // fire-and-forget
    };

    track();

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextState === "active"
      ) {
        foregroundTimerRef.current = setTimeout(track, 30_000);
      } else if (
        appStateRef.current === "active" &&
        nextState.match(/inactive|background/)
      ) {
        if (foregroundTimerRef.current !== null) {
          clearTimeout(foregroundTimerRef.current);
          foregroundTimerRef.current = null;
        }
      }
      appStateRef.current = nextState;
    });

    return () => {
      subscription.remove();
      if (foregroundTimerRef.current !== null) {
        clearTimeout(foregroundTimerRef.current);
        foregroundTimerRef.current = null;
      }
    };
  }, [user]);
}
