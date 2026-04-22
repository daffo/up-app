import { createContext, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { accountApi, userProfilesApi } from "./api";

const PASSWORD_RECOVERY_KEY = "@password_recovery_pending";

// Required for proper browser session dismissal on mobile
WebBrowser.maybeCompleteAuthSession();

async function setSessionFromRedirectUrl(
  url: string,
): Promise<{ error: any; isRecovery: boolean } | null> {
  const fragmentIndex = url.indexOf("#");
  if (fragmentIndex === -1) return null;

  const params = new URLSearchParams(url.substring(fragmentIndex + 1));
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  const type = params.get("type");

  if (!accessToken || !refreshToken) return null;

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  return { error, isRecovery: type === "recovery" };
}

type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  isPasswordRecovery: boolean;
  clearPasswordRecovery: () => void;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signInWithFacebook: () => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<{ error: any }>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  // Check admin status when user changes
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        setIsAdmin(false);
        return;
      }
      const { data } = await supabase
        .from("admins")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();
      setIsAdmin(!!data);
    };
    checkAdminStatus();
  }, [user]);

  useEffect(() => {
    // Check for incomplete password recovery — sign out to prevent session hijack
    const checkPendingRecovery = async () => {
      const pending = await AsyncStorage.getItem(PASSWORD_RECOVERY_KEY);
      if (pending) {
        await AsyncStorage.removeItem(PASSWORD_RECOVERY_KEY);
        await supabase.auth.signOut({ scope: "local" });
        setSession(null);
        setUser(null);
        setLoading(false);
        return true;
      }
      return false;
    };

    // Get initial session
    checkPendingRecovery().then((wasRecovery) => {
      if (wasRecovery) return;
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      });
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (event === "PASSWORD_RECOVERY") {
        AsyncStorage.setItem(PASSWORD_RECOVERY_KEY, "true");
        setIsPasswordRecovery(true);
      }
    });

    // Handle deep links for OAuth callback and password recovery (mobile only)
    const handleDeepLink = async (event: { url: string }) => {
      const result = await setSessionFromRedirectUrl(event.url);
      if (result?.isRecovery) {
        AsyncStorage.setItem(PASSWORD_RECOVERY_KEY, "true");
        setIsPasswordRecovery(true);
      }
    };

    // Listen for incoming deep links
    const linkSubscription = Linking.addEventListener("url", handleDeepLink);

    // Check if app was opened from a deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    return () => {
      subscription.unsubscribe();
      linkSubscription.remove();
    };
  }, []);

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signInWithOAuthProvider = async (
    provider: "google" | "facebook",
  ): Promise<{ error: any }> => {
    const redirectTo =
      Platform.OS === "web" ? window.location.origin : Linking.createURL("/");

    if (Platform.OS === "web") {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      });
      return { error };
    }

    // Mobile: use in-app browser session
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });

    if (error) return { error };

    if (data?.url) {
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectTo,
      );

      if (result.type === "success" && result.url) {
        const sessionResult = await setSessionFromRedirectUrl(result.url);
        if (sessionResult) return sessionResult;
      }
    }

    return { error: null };
  };

  const signInWithGoogle = () => signInWithOAuthProvider("google");
  const signInWithFacebook = () => signInWithOAuthProvider("facebook");

  const deleteAccount = async () => {
    if (!user) return { error: new Error("Not logged in") };

    try {
      await accountApi.deleteAllUserData(user.id);
      await signOut();
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // Ignore errors - just clear local state
    }

    userProfilesApi.clearCache();

    // Force update local state — signOut() already clears its own storage
    setSession(null);
    setUser(null);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        loading,
        isAdmin,
        isPasswordRecovery,
        clearPasswordRecovery: () => {
          AsyncStorage.removeItem(PASSWORD_RECOVERY_KEY);
          setIsPasswordRecovery(false);
        },
        signUp,
        signIn,
        signInWithGoogle,
        signInWithFacebook,
        signOut,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
