export const PREMIUM_SUBSCRIPTION_GROUP = 'OutdoorAdvisor Premium';

export const SUBSCRIPTION_PLANS = {
  monthly: {
    key: 'monthly',
    productId: 'com.ahmadadnanone.outdooradvisor.premium.monthly',
    label: 'Monthly',
    cadence: 'month',
    fallbackPrice: '$0.99 / month',
    reviewPriceNote: 'USD 0.99 internationally, PKR 99 in Pakistan',
    trialLabel: '15-day free trial',
    badge: '15 days free',
  },
  yearly: {
    key: 'yearly',
    productId: 'com.ahmadadnanone.outdooradvisor.premium.yearly',
    label: 'Yearly',
    cadence: 'year',
    fallbackPrice: '$10.99 / year',
    reviewPriceNote: 'One month free versus monthly pricing',
    trialLabel: '1 month free',
    badge: 'Best value',
  },
};

export const SUBSCRIPTION_PRODUCT_IDS = Object.values(SUBSCRIPTION_PLANS).map((plan) => plan.productId);
export const SUBSCRIPTION_TRIAL_DAYS = 15;

export function getPlanForProductId(productId) {
  return Object.values(SUBSCRIPTION_PLANS).find((plan) => plan.productId === productId) || null;
}

export function isPremiumSubscriptionProduct(productId) {
  return SUBSCRIPTION_PRODUCT_IDS.includes(productId);
}
