import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { isSupabaseConfigured, setSupabaseAutoRefresh, supabase } from '../lib/supabase';
import { derivePremiumState } from '../lib/premium';
import { SUBSCRIPTION_TRIAL_DAYS } from '../config/subscriptions';
import useStoreKitSubscriptions from '../hooks/useStoreKitSubscriptions';
import { buildApiUrl } from '../config/api';

const AuthContext = createContext();
const DEFAULT_WEB_AUTH_REDIRECT = 'https://outdooradvisor.vercel.app';

function getEmailRedirectTo() {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  return process.env.EXPO_PUBLIC_SITE_URL?.trim() || DEFAULT_WEB_AUTH_REDIRECT;
}

const DEFAULT_TRIAL_STATE = {
  inTrial: false,
  daysRemaining: 0,
  expiresAt: null,
  loading: false,
};

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const subscription = useStoreKitSubscriptions();
  const refreshStoreKitSubscriptions = subscription?.refreshSubscriptions;

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

  useEffect(() => {
    if (!user || !refreshStoreKitSubscriptions) return;
    refreshStoreKitSubscriptions().catch(() => {});
  }, [user, refreshStoreKitSubscriptions]);

  const signIn = useCallback(async ({ email, password }) => {
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
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  /**
   * Permanently delete the signed-in user's account on the server
   * (Supabase admin delete) and then sign out locally.
   *
   * Required for Apple App Store Guideline 5.1.1(v).
   */
  const deleteAccount = useCallback(async () => {
    if (!supabase) {
      throw new Error('Account deletion is not configured.');
    }
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) {
      throw new Error('You must be signed in to delete your account.');
    }

    // Consolidated into /api/push?action=delete-account (Hobby plan 12-fn limit).
    const response = await fetch(buildApiUrl('/api/push?action=delete-account'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok || !payload?.success) {
      const message = payload?.message || `Account deletion failed (${response.status})`;
      throw new Error(message);
    }

    // Local sign-out — clears the session even though the server-side user is gone.
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore — the server account is already deleted.
    }
  }, []);

  const value = useMemo(
    () => {
      const premiumState = derivePremiumState(user);
      // Premium now comes from StoreKit subscription state or internal allowlist.
      // The public trial is Apple-managed: users start it by subscribing with a
      // payment method, then StoreKit reports an active subscription entitlement.
      const entitlementPremium = premiumState.isPremium || subscription.isActive;
      const isPremium = entitlementPremium;
      const plan = subscription.isActive
        ? (subscription.activePlan || 'premium')
        : premiumState.plan;

      return {
        configured: isSupabaseConfigured,
        loading,
        session,
        user,
        isSignedIn: Boolean(user),
        isPremium,
        plan,
        entitlementPremium,
        trial: {
          ...DEFAULT_TRIAL_STATE,
          totalDays:     SUBSCRIPTION_TRIAL_DAYS,
          expired:       false,
        },
        subscription,
        signIn,
        signUp,
        signOut,
        deleteAccount,
      };
    },
    [loading, session, user, subscription, signIn, signUp, signOut, deleteAccount]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

export default AuthContext;
