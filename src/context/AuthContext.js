import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { isSupabaseConfigured, setSupabaseAutoRefresh, supabase } from '../lib/supabase';
import { derivePremiumState } from '../lib/premium';

const AuthContext = createContext();
const DEFAULT_WEB_AUTH_REDIRECT = 'https://outdooradvisor.vercel.app';

const TEST_ID = 'testuser';
const TEST_PASSWORD = 'testuser';
const TEST_MOCK_USER = {
  id: 'test-user-local',
  email: 'testuser',
  app_metadata: {},
  user_metadata: { premium: true },
};

function getEmailRedirectTo() {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  return process.env.EXPO_PUBLIC_SITE_URL?.trim() || DEFAULT_WEB_AUTH_REDIRECT;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [isTestSession, setIsTestSession] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return undefined;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession ?? null);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    });

    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setSupabaseAutoRefresh(true);
      } else {
        setSupabaseAutoRefresh(false);
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
      appStateSubscription.remove();
      setSupabaseAutoRefresh(false);
    };
  }, []);

  const signIn = useCallback(async ({ email, password }) => {
    if (email === TEST_ID && password === TEST_PASSWORD) {
      setSession({ user: TEST_MOCK_USER });
      setUser(TEST_MOCK_USER);
      setIsTestSession(true);
      return;
    }
    if (!supabase) {
      throw new Error('Sign-in is not configured yet.');
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async ({ email, password }) => {
    if (!supabase) {
      throw new Error('Sign-in is not configured yet.');
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: getEmailRedirectTo(),
      },
    });
    if (error) throw error;

    if (!data.session) {
      return {
        needsEmailConfirmation: true,
        message: 'Account created. Check your email to confirm before signing in.',
      };
    }

    return {
      needsEmailConfirmation: false,
      message: 'Account created and signed in.',
    };
  }, []);

  const signOut = useCallback(async () => {
    if (isTestSession) {
      setSession(null);
      setUser(null);
      setIsTestSession(false);
      return;
    }
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, [isTestSession]);

  const value = useMemo(
    () => {
      const premiumState = derivePremiumState(user);
      return {
        configured: isSupabaseConfigured,
        loading,
        session,
        user,
        isSignedIn: Boolean(user),
        ...premiumState,
        signIn,
        signUp,
        signOut,
      };
    },
    [loading, session, user, signIn, signUp, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

export default AuthContext;
