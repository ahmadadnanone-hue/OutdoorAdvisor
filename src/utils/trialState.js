/**
 * Device-based 7-day free trial.
 *
 * On first launch we record `firstLaunchAt` in AsyncStorage. While
 * the trial is active, `isPremium` is auto-granted in AuthContext so
 * every gated feature (AI briefing, forecast, pollen, wind, details,
 * route closure alerts, etc.) is unlocked.
 *
 * When the trial expires the user settles permanently into the free
 * tier (per Apple's rules — no IAP needed because we never charge).
 *
 * Notes:
 *   • Reinstalling the app resets the trial. Acceptable for v1.0.
 *   • Device time manipulation is not defended against in v1.0.
 *   • The seed-on-first-read pattern means even users upgrading
 *     from a build that didn't have trial logic get a fresh 7 days.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const TRIAL_KEY  = 'outdooradvisor_trial_v1';
const DAY_MS     = 24 * 60 * 60 * 1000;
export const TRIAL_DAYS_TOTAL = 7;
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
