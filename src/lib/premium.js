export const PREMIUM_FEATURES = {
  aiBriefings: 'AI daily briefings',
  routeScans: 'Stop-by-stop route scans',
  nearbyPlaces: 'Nearby venue suggestions',
  browserPush: 'Cross-device browser push',
  pollenAlerts: 'High pollen alerts',
  smogAlerts: 'Smog season alerts',
  fogWarnings: 'Motorway fog warnings',
  routeClosureAlerts: 'Major route closure alerts',
};

const ACTIVE_STATUSES = new Set(['active', 'premium', 'pro', 'paid', 'trialing', 'trial']);
const SEEDED_PREMIUM_EMAILS = ['ahmadadnanone@gmail.com', 'saqibmasoodcma@google.com'];

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function parsePremiumEmailAllowlist(input) {
  return String(input || '')
    .split(',')
    .map((value) => normalizeEmail(value))
    .filter(Boolean);
}

function getPremiumEmailAllowlist(input) {
  return [...new Set([...SEEDED_PREMIUM_EMAILS.map((value) => normalizeEmail(value)), ...parsePremiumEmailAllowlist(input)])];
}

function isTruthyPremium(value) {
  if (value === true) return true;
  if (typeof value === 'string') {
    return ACTIVE_STATUSES.has(value.trim().toLowerCase());
  }
  return false;
}

export function derivePremiumState(user) {
  const appMeta = user?.app_metadata || {};
  const userMeta = user?.user_metadata || {};
  const email = normalizeEmail(user?.email);
  const allowlistedEmails = getPremiumEmailAllowlist(process.env.EXPO_PUBLIC_PREMIUM_EMAILS);
  const entitlementList = [
    appMeta.plan,
    appMeta.tier,
    appMeta.subscription_status,
    appMeta.subscriptionStatus,
    appMeta.entitlement,
    appMeta.entitlements,
    userMeta.plan,
    userMeta.tier,
    userMeta.subscription_status,
    userMeta.subscriptionStatus,
    userMeta.entitlement,
    userMeta.entitlements,
    appMeta.is_premium,
    appMeta.isPremium,
    appMeta.premium,
    userMeta.is_premium,
    userMeta.isPremium,
    userMeta.premium,
  ];

  const isPremium = entitlementList.some((value) => {
    if (Array.isArray(value)) {
      return value.some(isTruthyPremium);
    }
    return isTruthyPremium(value);
  }) || (email && allowlistedEmails.includes(email));

  const plan =
    (typeof appMeta.plan === 'string' && appMeta.plan) ||
    (typeof appMeta.tier === 'string' && appMeta.tier) ||
    (typeof userMeta.plan === 'string' && userMeta.plan) ||
    (typeof userMeta.tier === 'string' && userMeta.tier) ||
    (isPremium ? 'premium' : 'free');

  return {
    isPremium,
    plan: String(plan || 'free').toLowerCase(),
  };
}

export function getPremiumFeatureCopy(featureKey) {
  return PREMIUM_FEATURES[featureKey] || 'Premium feature';
}
