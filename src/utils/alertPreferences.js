import AsyncStorage from '@react-native-async-storage/async-storage';

export const THRESHOLDS_KEY = 'routeadvisor_thresholds';
export const NOTIFICATIONS_KEY = 'routeadvisor_notifications';
export const MOCK_ACCOUNT_KEY = 'routeadvisor_mock_account';

export const DEFAULT_THRESHOLDS = {
  aqiAlert: 150,
  pm25Alert: 75,
  heatAlert: 42,
  coldAlert: 5,
};

export const DEFAULT_NOTIFICATIONS = {
  severeAqiWarnings: true,
  dailySummary: true,
  smogAlerts: true,
  rainAlerts: true,
  thunderstormAlerts: true,
  windAlerts: true,
  pollenAlerts: false,
  heatAlerts: true,
  fogWarnings: true,
  routeClosureAlerts: true,
};

export async function loadStoredThresholds() {
  try {
    const raw = await AsyncStorage.getItem(THRESHOLDS_KEY);
    return raw ? { ...DEFAULT_THRESHOLDS, ...JSON.parse(raw) } : DEFAULT_THRESHOLDS;
  } catch {
    return DEFAULT_THRESHOLDS;
  }
}

export async function loadStoredNotifications() {
  try {
    const raw = await AsyncStorage.getItem(NOTIFICATIONS_KEY);
    return raw ? { ...DEFAULT_NOTIFICATIONS, ...JSON.parse(raw) } : DEFAULT_NOTIFICATIONS;
  } catch {
    return DEFAULT_NOTIFICATIONS;
  }
}

export async function saveStoredThresholds(thresholds) {
  await AsyncStorage.setItem(THRESHOLDS_KEY, JSON.stringify(thresholds));
}

export async function saveStoredNotifications(notifications) {
  await AsyncStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
}

export async function loadMockAccount() {
  try {
    const raw = await AsyncStorage.getItem(MOCK_ACCOUNT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveMockAccount(account) {
  if (!account) {
    await AsyncStorage.removeItem(MOCK_ACCOUNT_KEY);
    return;
  }
  await AsyncStorage.setItem(MOCK_ACCOUNT_KEY, JSON.stringify(account));
}
