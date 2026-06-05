import React, { useCallback } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GlassCard } from './glass';
import { colors as dc } from '../design';
import { useAuth } from '../context/AuthContext';

/**
 * Premium / free-trial subscribe card. Lives in Settings → Account (next to the
 * sign-in form) instead of on the Home screen. Renders nothing for premium users.
 */
export default function PremiumCard({ style }) {
  const { isPremium, isSignedIn, subscription } = useAuth();

  const startSubscription = useCallback(async (planKey) => {
    if (!isSignedIn) {
      Alert.alert(
        'Sign in to start premium',
        'Sign in to your OutdoorAdvisor account above first, then subscribe with Apple so premium can be restored cleanly later.'
      );
      return;
    }
    try {
      await subscription?.subscribeToPlan?.(planKey);
    } catch (error) {
      if (error?.code === 'user-cancelled') return;
      Alert.alert('Subscription unavailable', error?.message || 'Please try again in a moment.');
    }
  }, [isSignedIn, subscription]);

  const restoreSubscription = useCallback(async () => {
    if (!isSignedIn) {
      Alert.alert(
        'Sign in to restore premium',
        'Sign in to your account above first, then restore your Apple purchase so the active subscription is attached to your session.'
      );
      return;
    }
    try {
      await subscription?.restoreSubscriptions?.();
      Alert.alert('Restore complete', 'If an active subscription exists for this Apple ID, premium will unlock automatically.');
    } catch (error) {
      Alert.alert('Restore unavailable', error?.message || 'Please try again in a moment.');
    }
  }, [isSignedIn, subscription]);

  if (isPremium) return null;

  return (
    <GlassCard style={style} contentStyle={styles.subscribeContent}>
      <Text style={styles.subscribeEyebrow}>PREMIUM</Text>
      <Text style={styles.subscribeTitle}>Start your free trial with Apple</Text>
      <Text style={styles.subscribeBody}>
        Subscribe with Apple to start the free trial. Core weather, AQI, and travel advisories stay free if you do not subscribe.
      </Text>
      {!isSignedIn ? (
        <Text style={styles.signInHint}>Sign in to your account above to subscribe.</Text>
      ) : null}
      <View style={styles.subscribePlans}>
        {(subscription?.plans || []).map((plan) => {
          const loadingPlan = subscription?.purchasingPlan === plan.key;
          const planUnavailable = subscription?.supported && !plan.available;
          const buttonDisabled = loadingPlan || planUnavailable || !isSignedIn;
          return (
            <TouchableOpacity
              key={plan.key}
              activeOpacity={0.82}
              disabled={buttonDisabled}
              style={[
                styles.subscribeButton,
                plan.key === 'yearly' && styles.subscribeButtonFeatured,
                planUnavailable && styles.subscribeButtonDisabled,
                !isSignedIn && styles.subscribeButtonDisabled,
              ]}
              onPress={() => startSubscription(plan.key)}
            >
              <View style={styles.subscribeButtonTextWrap}>
                <Text style={styles.subscribeButtonTitle}>{plan.label}</Text>
                <Text style={styles.subscribeButtonSub}>
                  {planUnavailable ? 'Waiting for Apple product setup' : `${plan.trialLabel} · ${plan.price}`}
                </Text>
              </View>
              <Text style={styles.subscribeButtonBadge}>
                {!isSignedIn ? 'Sign in' : loadingPlan ? 'Opening...' : planUnavailable ? 'Pending' : plan.badge}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {!!subscription?.error && <Text style={styles.subscribeError}>{subscription.error}</Text>}
      <TouchableOpacity onPress={restoreSubscription} style={styles.restoreButton} activeOpacity={0.75}>
        <Text style={styles.restoreButtonText}>Restore purchases</Text>
      </TouchableOpacity>
      <Text style={styles.subscribeFinePrint}>
        Subscriptions renew automatically through Apple unless cancelled at least 24 hours before renewal. Manage or cancel in your Apple ID subscriptions.
      </Text>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  subscribeContent: { padding: 16, gap: 10 },
  subscribeEyebrow: { fontSize: 10, fontWeight: '800', color: '#FCD34D', letterSpacing: 1.4 },
  subscribeTitle: { fontSize: 17, fontWeight: '800', color: dc.textPrimary },
  subscribeBody: { fontSize: 13, lineHeight: 19, color: dc.textSecondary },
  signInHint: { fontSize: 12.5, fontWeight: '600', color: dc.accentCyan },
  subscribePlans: { gap: 8, marginTop: 2 },
  subscribeButton: {
    minHeight: 58,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: dc.cardStroke,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  subscribeButtonFeatured: {
    borderColor: 'rgba(252,211,77,0.52)',
    backgroundColor: 'rgba(252,211,77,0.10)',
  },
  subscribeButtonDisabled: { opacity: 0.62 },
  subscribeButtonTextWrap: { flex: 1, minWidth: 0 },
  subscribeButtonTitle: { fontSize: 14, fontWeight: '800', color: dc.textPrimary },
  subscribeButtonSub: { fontSize: 12, color: dc.textSecondary, marginTop: 3 },
  subscribeButtonBadge: { fontSize: 11, fontWeight: '800', color: dc.accentCyan },
  subscribeError: { fontSize: 12, lineHeight: 17, color: dc.accentOrange },
  restoreButton: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 10 },
  restoreButtonText: { fontSize: 12, fontWeight: '700', color: dc.accentCyan },
  subscribeFinePrint: { fontSize: 11, lineHeight: 16, color: dc.textMuted, textAlign: 'center' },
});
