import AsyncStorage from '@react-native-async-storage/async-storage';

export const THRESHOLDS_KEY = 'outdooradvisor_thresholds';
export const NOTIFICATIONS_KEY = 'outdooradvisor_notifications';
export const MOCK_ACCOUNT_KEY = 'outdooradvisor_mock_account';
export const MOTORWAY_SUBSCRIPTIONS_KEY = 'outdooradvisor_motorway_subscriptions_v1';
export const BRIEF_RESTORE_MARKER_KEY = '_briefsRestoredAt';
const BRIEF_RESTORE_MARKER_VALUE = '2026-06-23';

export const MOTORWAY_ROUTES = [
  { id: 'M1',  label: 'M-1',  desc: 'Islamabad – Peshawar' },
  { id: 'M2',  label: 'M-2',  desc: 'Lahore – Islamabad' },
  { id: 'M3',  label: 'M-3',  desc: 'Lahore – Abdul Hakam' },
  { id: 'M4',  label: 'M-4',  desc: 'Gojra – Multan' },
  { id: 'M5',  label: 'M-5',  desc: 'Multan – Sukkur' },
  { id: 'M8',  label: 'M-8',  desc: 'Ratodero – Gwadar' },
  { id: 'M9',  label: 'M-9',  desc: 'Karachi – Hyderabad' },
  { id: 'E35', label: 'E-35', desc: 'Hazara Expressway' },
];

export const DEFAULT_THRESHOLDS = {
  aqiAlert: 150,
  pm25Alert: 75,
  heatAlert: 42,
  coldAlert: 5,
  windAlert: 40, // wind gust speed (km/h) that triggers a sudden wind/dust-storm alert
  rainProbabilityAlert: 60,
  rainProbabilityJump: 25,
  rainLeadHours: 3,
};

export const DEFAULT_NOTIFICATIONS = {
  officialAdvisories: true,
  severeAqiWarnings: true,
  dailySummary: true,
  eveningPlanner: true,
  goodWindowAlerts: false,
  coldAlerts: false,
  smartWalkNudges: false,
  smogAlerts: true,
  rainAlerts: true,
  thunderstormAlerts: true,
  windAlerts: true,
  pollenAlerts: false,
  heatAlerts: true,
  fogWarnings: true,
  routeClosureAlerts: true,
  motorwayAlerts: false,
};

function normalizeStoredNotifications(parsed) {
  const source = parsed && typeof parsed === 'object' ? parsed : {};
  const merged = { ...DEFAULT_NOTIFICATIONS, ...source };

  // Restore the daily brief toggles once after the temporary noise-reduction
  // release. Future user opt-outs keep working because saves include a marker.
  if (!source[BRIEF_RESTORE_MARKER_KEY]) {
    merged.dailySummary = true;
    merged.eveningPlanner = true;
  }

  merged[BRIEF_RESTORE_MARKER_KEY] = source[BRIEF_RESTORE_MARKER_KEY] || BRIEF_RESTORE_MARKER_VALUE;
  return merged;
}

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
    return raw
      ? normalizeStoredNotifications(JSON.parse(raw))
      : { ...DEFAULT_NOTIFICATIONS, [BRIEF_RESTORE_MARKER_KEY]: BRIEF_RESTORE_MARKER_VALUE };
  } catch {
    return { ...DEFAULT_NOTIFICATIONS, [BRIEF_RESTORE_MARKER_KEY]: BRIEF_RESTORE_MARKER_VALUE };
  }
}

export async function saveStoredThresholds(thresholds) {
  await AsyncStorage.setItem(THRESHOLDS_KEY, JSON.stringify(thresholds));
}

export async function saveStoredNotifications(notifications) {
  await AsyncStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify({
    ...notifications,
    [BRIEF_RESTORE_MARKER_KEY]: notifications?.[BRIEF_RESTORE_MARKER_KEY] || BRIEF_RESTORE_MARKER_VALUE,
  }));
}

export async function loadMockAccount() {
  try {
    const raw = await AsyncStorage.getItem(MOCK_ACCOUNT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function loadStoredMotorwaySubscriptions() {
  try {
    const raw = await AsyncStorage.getItem(MOTORWAY_SUBSCRIPTIONS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export async function saveStoredMotorwaySubscriptions(subscriptions) {
  await AsyncStorage.setItem(MOTORWAY_SUBSCRIPTIONS_KEY, JSON.stringify(subscriptions));
}

export async function saveMockAccount(account) {
  if (!account) {
    await AsyncStorage.removeItem(MOCK_ACCOUNT_KEY);
    return;
  }
  await AsyncStorage.setItem(MOCK_ACCOUNT_KEY, JSON.stringify(account));
}
