import { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

// Required for proper browser session dismissal on mobile
WebBrowser.maybeCompleteAuthSession();

type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signInWithFacebook: () => Promise<{ error: any }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Handle deep links for OAuth callback (mobile only - fallback)
    const handleDeepLink = async (event: { url: string }) => {
      const url = event.url;

      // Check if this is an OAuth callback with tokens
      if (url.includes('access_token') || url.includes('refresh_token')) {
        // Extract the fragment (everything after #)
        const fragmentIndex = url.indexOf('#');
        if (fragmentIndex !== -1) {
          const fragment = url.substring(fragmentIndex + 1);
          const params = new URLSearchParams(fragment);
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');

          if (accessToken && refreshToken) {
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
          }
        }
      }
    };

    // Listen for incoming deep links
    const linkSubscription = Linking.addEventListener('url', handleDeepLink);

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

  const signInWithGoogle = async () => {
    const redirectTo = Platform.OS === 'web'
      ? window.location.origin
      : Linking.createURL('/');

    if (Platform.OS === 'web') {
      // Web: use default browser redirect
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      });
      return { error };
    }

    // Mobile: use in-app browser session
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: true, // Don't auto-open browser, we'll do it manually
      },
    });

    if (error) return { error };

    if (data?.url) {
      // Open auth URL in an in-app browser that can intercept the redirect
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      if (result.type === 'success' && result.url) {
        // Extract tokens from the redirect URL
        const url = result.url;
        const fragmentIndex = url.indexOf('#');
        if (fragmentIndex !== -1) {
          const fragment = url.substring(fragmentIndex + 1);
          const params = new URLSearchParams(fragment);
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');

          if (accessToken && refreshToken) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            return { error: sessionError };
          }
        }
      }
    }

    return { error: null };
  };

  const signInWithFacebook = async () => {
    const redirectTo = Platform.OS === 'web'
      ? window.location.origin
      : Linking.createURL('/');

    if (Platform.OS === 'web') {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'facebook',
        options: { redirectTo },
      });
      return { error };
    }

    // Mobile: use in-app browser session
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'facebook',
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });

    if (error) return { error };

    if (data?.url) {
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      if (result.type === 'success' && result.url) {
        const url = result.url;
        const fragmentIndex = url.indexOf('#');
        if (fragmentIndex !== -1) {
          const fragment = url.substring(fragmentIndex + 1);
          const params = new URLSearchParams(fragment);
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');

          if (accessToken && refreshToken) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            return { error: sessionError };
          }
        }
      }
    }

    return { error: null };
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      // Ignore errors - just clear local state
    }

    // Always clear local storage and state regardless of API result
    try {
      await AsyncStorage.removeItem('supabase.auth.token');
      await AsyncStorage.clear();
    } catch {
      // Ignore storage errors
    }

    // Force update local state
    setSession(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        loading,
        signUp,
        signIn,
        signInWithGoogle,
        signInWithFacebook,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
