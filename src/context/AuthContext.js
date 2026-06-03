import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { isSupabaseConfigured, setSupabaseAutoRefresh, supabase } from '../lib/supabase';
import { derivePremiumState } from '../lib/premium';
import { SUBSCRIPTION_TRIAL_DAYS } from '../config/subscriptions';
import useStoreKitSubscriptions from '../hooks/useStoreKitSubscriptions';
import { buildApiUrl } from '../config/api';

const AuthContext = createContext();

/**
 * Map raw Supabase / network auth errors to short, user-friendly messages.
 * Falls back to the original message so we never hide unexpected failures.
 */
export function mapAuthError(error) {
  const raw = (error?.message || '').toLowerCase();

  if (!raw) return 'Something went wrong. Please try again.';
  if (raw.includes('invalid login credentials')) return 'Incorrect email or password.';
  if (raw.includes('email not confirmed')) return 'Please verify your email first — enter the 6-digit code we sent you.';
  if (raw.includes('user already registered') || raw.includes('already been registered')) {
    return 'An account with this email already exists. Try signing in instead.';
  }
  if (raw.includes('token has expired') || raw.includes('invalid') && raw.includes('token')) {
    return 'That code is expired or incorrect. Tap “Resend code” to get a new one.';
  }
  if (raw.includes('otp') && (raw.includes('expired') || raw.includes('invalid'))) {
    return 'That code is expired or incorrect. Tap “Resend code” to get a new one.';
  }
  if (raw.includes('for security purposes') || raw.includes('rate limit') || raw.includes('only request this after')) {
    return 'Please wait a few seconds before requesting another code.';
  }
  if (raw.includes('password should be at least') || raw.includes('weak password')) {
    return 'Password must be at least 6 characters.';
  }
  if (raw.includes('unable to validate email') || raw.includes('invalid email')) {
    return 'Please enter a valid email address.';
  }
  if (raw.includes('network') || raw.includes('failed to fetch') || raw.includes('timeout')) {
    return 'Network error. Check your connection and try again.';
  }
  if (raw.includes('canceled') || raw.includes('cancelled') || raw.includes('au_canceled')) {
    return 'Sign-in was cancelled.';
  }
  return error?.message || 'Something went wrong. Please try again.';
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
    if (!supabase) throw new Error('Authentication is not configured yet.');
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) throw new Error(mapAuthError(error));
  }, []);

  /**
   * Create an account. With Supabase "Confirm email" ON and the email template
   * configured to send {{ .Token }}, this emails a 6-digit code instead of a
   * magic link. The UI then collects the code and calls verifyCode().
   */
  const signUp = useCallback(async ({ email, password }) => {
    if (!supabase) throw new Error('Authentication is not configured yet.');
    const cleanEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signUp({ email: cleanEmail, password });
    if (error) throw new Error(mapAuthError(error));

    // No session => email confirmation required (a 6-digit code was sent).
    return {
      needsVerification: !data.session,
      email: cleanEmail,
    };
  }, []);

  /** Verify the 6-digit sign-up code from email. On success the user is signed in. */
  const verifyCode = useCallback(async ({ email, token }) => {
    if (!supabase) throw new Error('Authentication is not configured yet.');
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: token.trim(),
      type: 'signup',
    });
    if (error) throw new Error(mapAuthError(error));
  }, []);

  /** Resend a sign-up confirmation code. */
  const resendCode = useCallback(async ({ email }) => {
    if (!supabase) throw new Error('Authentication is not configured yet.');
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim().toLowerCase(),
    });
    if (error) throw new Error(mapAuthError(error));
  }, []);

  /** Step 1 of password reset: email a 6-digit recovery code. */
  const requestPasswordReset = useCallback(async ({ email }) => {
    if (!supabase) throw new Error('Authentication is not configured yet.');
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
    if (error) throw new Error(mapAuthError(error));
  }, []);

  /** Step 2 of password reset: verify the recovery code, then set a new password. */
  const confirmPasswordReset = useCallback(async ({ email, token, newPassword }) => {
    if (!supabase) throw new Error('Authentication is not configured yet.');
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: token.trim(),
      type: 'recovery',
    });
    if (verifyError) throw new Error(mapAuthError(verifyError));

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) throw new Error(mapAuthError(updateError));
  }, []);

  /** One-tap Sign in with Apple (iOS only). */
  const signInWithApple = useCallback(async () => {
    if (!supabase) throw new Error('Authentication is not configured yet.');
    if (Platform.OS !== 'ios') throw new Error('Sign in with Apple is available on iPhone.');

    // Lazy require so non-iOS / Expo Go builds without the native module don't crash on import.
    let AppleAuthentication;
    try {
      AppleAuthentication = require('expo-apple-authentication');
    } catch {
      throw new Error('Sign in with Apple is not available in this build.');
    }

    let credential;
    try {
      credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
    } catch (err) {
      if (err?.code === 'ERR_REQUEST_CANCELED') throw new Error('Sign-in was cancelled.');
      throw new Error(mapAuthError(err));
    }

    if (!credential?.identityToken) {
      throw new Error('Apple did not return a sign-in token. Please try again.');
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    });
    if (error) throw new Error(mapAuthError(error));
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
        verifyCode,
        resendCode,
        requestPasswordReset,
        confirmPasswordReset,
        signInWithApple,
        appleAuthAvailable: Platform.OS === 'ios',
        signOut,
        deleteAccount,
      };
    },
    [
      loading, session, user, subscription,
      signIn, signUp, verifyCode, resendCode,
      requestPasswordReset, confirmPasswordReset, signInWithApple,
      signOut, deleteAccount,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

export default AuthContext;
