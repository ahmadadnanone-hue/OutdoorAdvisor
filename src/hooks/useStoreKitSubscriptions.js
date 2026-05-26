import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { ErrorCode, finishTransaction, useIAP } from 'expo-iap';
import {
  SUBSCRIPTION_PLANS,
  SUBSCRIPTION_PRODUCT_IDS,
  getPlanForProductId,
  isPremiumSubscriptionProduct,
} from '../config/subscriptions';

const EMPTY_PRODUCTS = [];

function getProductId(item) {
  return item?.productId || item?.id || item?.currentPlanId || null;
}

function isActivePurchase(purchase) {
  const productId = getProductId(purchase);
  if (!isPremiumSubscriptionProduct(productId)) return false;
  if (purchase?.purchaseState && purchase.purchaseState !== 'purchased') return false;
  if (purchase?.revocationDateIOS) return false;
  if (purchase?.expirationDateIOS && Number(purchase.expirationDateIOS) <= Date.now()) return false;
  return true;
}

function normalizeError(error) {
  if (!error) return null;
  if (error.code === ErrorCode.UserCancelled) return null;
  return error.message || 'Subscription is unavailable right now.';
}

export default function useStoreKitSubscriptions() {
  const nativeStoreSupported = Platform.OS === 'ios';
  const [error, setError] = useState(null);
  const [purchasingPlan, setPurchasingPlan] = useState(null);
  const [lastPurchase, setLastPurchase] = useState(null);

  const {
    activeSubscriptions,
    availablePurchases,
    connected,
    fetchProducts,
    getActiveSubscriptions,
    getAvailablePurchases,
    reconnect,
    requestPurchase,
    restorePurchases,
    subscriptions,
  } = useIAP({
    onPurchaseSuccess: async (purchase) => {
      setError(null);
      setLastPurchase(purchase);
      setPurchasingPlan(null);

      if (isActivePurchase(purchase)) {
        try {
          await finishTransaction({ purchase, isConsumable: false });
        } catch (finishError) {
          setError(finishError?.message || 'Purchase completed, but final confirmation failed.');
        }
      }
    },
    onPurchaseError: (purchaseError) => {
      setPurchasingPlan(null);
      setError(normalizeError(purchaseError));
    },
    onError: (nextError) => {
      setError(nextError?.message || 'Subscriptions are unavailable right now.');
    },
  });

  const refreshSubscriptions = useCallback(async () => {
    if (!nativeStoreSupported) return;

    try {
      if (!connected) {
        await reconnect();
      }
      await fetchProducts({ skus: SUBSCRIPTION_PRODUCT_IDS, type: 'subs' });
      await getActiveSubscriptions(SUBSCRIPTION_PRODUCT_IDS);
      await getAvailablePurchases({ onlyIncludeActiveItemsIOS: true });
    } catch (nextError) {
      setError(nextError?.message || 'Could not refresh subscription status.');
    }
  }, [connected, fetchProducts, getActiveSubscriptions, getAvailablePurchases, nativeStoreSupported, reconnect]);

  useEffect(() => {
    if (!nativeStoreSupported || !connected) return;
    refreshSubscriptions();
  }, [connected, nativeStoreSupported, refreshSubscriptions]);

  useEffect(() => {
    if (!lastPurchase || !nativeStoreSupported) return;
    refreshSubscriptions();
  }, [lastPurchase, nativeStoreSupported, refreshSubscriptions]);

  const subscriptionProducts = nativeStoreSupported ? subscriptions || EMPTY_PRODUCTS : EMPTY_PRODUCTS;

  const productsById = useMemo(() => {
    const map = new Map();
    subscriptionProducts.forEach((product) => {
      const productId = getProductId(product);
      if (productId) map.set(productId, product);
    });
    return map;
  }, [subscriptionProducts]);

  const plans = useMemo(() => Object.values(SUBSCRIPTION_PLANS).map((plan) => {
    const product = productsById.get(plan.productId);
    return {
      ...plan,
      product,
      price: product?.displayPrice || product?.localizedPrice || plan.fallbackPrice,
      title: product?.displayName || product?.title || plan.label,
      available: Boolean(product),
    };
  }), [productsById]);

  const activeSubscription = useMemo(() => {
    const activeFromStore = (activeSubscriptions || []).find((subscription) => (
      subscription?.isActive && isPremiumSubscriptionProduct(getProductId(subscription))
    ));
    if (activeFromStore) return activeFromStore;

    const activeFromPurchases = (availablePurchases || []).find(isActivePurchase);
    if (activeFromPurchases) return activeFromPurchases;

    if (isActivePurchase(lastPurchase)) return lastPurchase;
    return null;
  }, [activeSubscriptions, availablePurchases, lastPurchase]);

  const subscribeToPlan = useCallback(async (planKey) => {
    const plan = SUBSCRIPTION_PLANS[planKey];
    if (!plan) throw new Error('Unknown subscription plan.');
    if (!nativeStoreSupported) throw new Error('Subscriptions are available in the iOS app.');

    setError(null);
    setPurchasingPlan(planKey);

    try {
      if (!connected) {
        await reconnect();
      }

      await requestPurchase({
        request: {
          apple: { sku: plan.productId },
          google: { skus: [plan.productId] },
        },
        type: 'subs',
      });
    } catch (nextError) {
      setPurchasingPlan(null);
      const message = normalizeError(nextError);
      if (message) setError(message);
      throw nextError;
    }
  }, [connected, nativeStoreSupported, reconnect, requestPurchase]);

  const restoreSubscriptions = useCallback(async () => {
    if (!nativeStoreSupported) throw new Error('Subscriptions are available in the iOS app.');

    setError(null);
    try {
      if (!connected) {
        await reconnect();
      }
      await restorePurchases({ onlyIncludeActiveItemsIOS: true });
      await getActiveSubscriptions(SUBSCRIPTION_PRODUCT_IDS);
      await getAvailablePurchases({ onlyIncludeActiveItemsIOS: true });
    } catch (nextError) {
      setError(nextError?.message || 'Could not restore purchases.');
      throw nextError;
    }
  }, [connected, getActiveSubscriptions, getAvailablePurchases, nativeStoreSupported, reconnect, restorePurchases]);

  const activeProductId = getProductId(activeSubscription);
  const activePlan = getPlanForProductId(activeProductId);

  return {
    supported: nativeStoreSupported,
    connected,
    loading: nativeStoreSupported && !connected,
    refreshing: nativeStoreSupported && Boolean(connected) && subscriptionProducts.length === 0,
    isActive: Boolean(activeSubscription),
    activeProductId,
    activePlan: activePlan?.key || null,
    activeSubscription,
    plans,
    products: subscriptionProducts,
    purchasingPlan,
    error,
    subscribeToPlan,
    restoreSubscriptions,
    refreshSubscriptions,
  };
}
