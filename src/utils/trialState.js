/**
 * Legacy device-based trial helper.
 *
 * Public premium trials are now Apple-managed introductory offers. A user must
 * subscribe with a payment method before StoreKit starts the free-trial period.
 * This helper is retained only as a dev/reset utility and for migration safety.
 *
 * Do not use this to grant production premium access.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const TRIAL_KEY  = 'outdooradvisor_trial_v1';
const DAY_MS     = 24 * 60 * 60 * 1000;
export const TRIAL_DAYS_TOTAL = 15;
const TRIAL_MS   = TRIAL_DAYS_TOTAL * DAY_MS;

export async function getTrialState() {
  try {
    const raw = await AsyncStorage.getItem(TRIAL_KEY);
    let firstLaunchAt = null;
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && Number.isFinite(Number(parsed.firstLaunchAt))) {
          firstLaunchAt = Number(parsed.firstLaunchAt);
        }
      } catch {
        firstLaunchAt = null;
      }
    }

    if (!firstLaunchAt) {
      firstLaunchAt = Date.now();
      await AsyncStorage.setItem(TRIAL_KEY, JSON.stringify({ firstLaunchAt }));
    }

    const now         = Date.now();
    const elapsedMs   = Math.max(0, now - firstLaunchAt);
    const remainingMs = Math.max(0, TRIAL_MS - elapsedMs);
    const inTrial     = remainingMs > 0;
    const daysRemaining = inTrial ? Math.max(1, Math.ceil(remainingMs / DAY_MS)) : 0;

    return {
      inTrial,
      daysRemaining,
      firstLaunchAt,
      expiresAt: firstLaunchAt + TRIAL_MS,
    };
  } catch {
    // Storage failure — fail closed (no trial granted) rather than open.
    return { inTrial: false, daysRemaining: 0, firstLaunchAt: null, expiresAt: null };
  }
}

/** Dev-only helper. Not wired into any UI. */
export async function _resetTrialForDev() {
  await AsyncStorage.removeItem(TRIAL_KEY);
}
