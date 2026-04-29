import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Switch,
  TextInput,
  StyleSheet,
  SafeAreaView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useSettings, ALL_FAB_ACTION_IDS } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { getPremiumFeatureCopy } from '../lib/premium';
// Web push is not used on iOS — stubs keep Platform.OS === 'web' branches safe
const isWebPushSupported = () => false;
const hasPushSubscription = () => Promise.resolve(false);
const getWebNotificationPermission = () => 'default';
const ensureWebPush = () => Promise.resolve();
const syncWebPushPreferences = () => Promise.resolve();
import {
  DEFAULT_NOTIFICATIONS,
  DEFAULT_THRESHOLDS,
  MOTORWAY_ROUTES,
  loadStoredMotorwaySubscriptions,
  loadStoredNotifications,
  loadStoredThresholds,
  saveStoredMotorwaySubscriptions,
  saveStoredNotifications,
  saveStoredThresholds,
} from '../utils/alertPreferences';
import { ensureLocalNotificationPermission } from '../utils/alertNotifications';
import { registerNativePushToken } from '../services/pushRegistration';
import { GlassCard } from '../components/glass';
import { ScreenGradient } from '../components/layout';
import AboutTab from '../components/settings/AboutTab';
import { colors as dc } from '../design';

const TABS = ['Thresholds', 'Notifications', 'Customize', 'About'];
const PREMIUM_HOME_SECTION_KEYS = new Set(['pollen', 'wind', 'details', 'forecast']);
const PREMIUM_NOTIFICATION_KEYS = new Set(['smogAlerts', 'pollenAlerts', 'fogWarnings', 'routeClosureAlerts', 'motorwayAlerts']);

const SECTION_META = {
  decision:   { label: 'Outdoor Decision',     icon: '🧭', desc: 'Plain-language go / go with care / limit exposure answer' },
  travel:     { label: 'Travel Quick Checks',  icon: '🛣️', desc: 'Fast access to Murree and M2 route conditions' },
  aqi:        { label: 'Live Conditions',      icon: '🌤️', desc: 'Primary live conditions card with AQI and targeted quick taps' },
  pollen:     { label: 'Pollen Level',         icon: '🌼', desc: 'Separate allergy and pollen snapshot for users who want it visible' },
  wind:       { label: 'Wind',                 icon: '💨', desc: 'Wind speed, gusts & direction' },
  details:    { label: 'Current Details',      icon: '📊', desc: 'Feels like, PM2.5, and temperature summary cards' },
  forecast:   { label: '7-Day Forecast',       icon: '📅', desc: 'Weekly weather outlook' },
  activities: { label: 'Activity Advisory',    icon: '🏃', desc: 'Outdoor activity recommendations' },
};
const ALL_SECTION_KEYS = Object.keys(SECTION_META);

const FAB_ACTION_META = {
  refresh:    { label: 'Refresh Data',     icon: '🔄', desc: 'Force-fetch latest weather and AQI data.', premium: true,  note: 'Up to 5 times per hour.' },
  'ai-brief': { label: 'AI Brief',         icon: '✨', desc: 'Refresh your AI-generated outdoor briefing on demand.', premium: true },
  location:   { label: 'Change City',      icon: '📍', desc: 'Open the city and location picker instantly.' },
  activities: { label: 'Outdoors',         icon: '🏃', desc: 'Jump straight to outdoor activity scoring.' },
  travel:     { label: 'Travel',           icon: '🗺️', desc: 'Open road and route condition checks.' },
  share:      { label: 'Share App',        icon: '📤', desc: 'Share OutdoorAdvisor with friends and family.' },
};

/* ---------- Custom Slider ---------- */
function CustomSlider({ value, min, max, step = 1, onValueChange, trackColor }) {
  const clamp = (v) => Math.min(max, Math.max(min, v));
  const decrement = () => onValueChange(clamp(value - step));
  const increment = () => onValueChange(clamp(value + step));
  const handleTextChange = (text) => {
    const num = parseInt(text, 10);
    if (!isNaN(num)) onValueChange(clamp(num));
  };
  const fraction = (value - min) / (max - min);

  return (
    <View style={sliderStyles.container}>
      <View style={sliderStyles.row}>
        <TouchableOpacity style={sliderStyles.btn} onPress={decrement} activeOpacity={0.6}>
          <Text style={sliderStyles.btnText}>-</Text>
        </TouchableOpacity>
        <View style={sliderStyles.trackOuter}>
          <View style={sliderStyles.track}>
            <View style={[sliderStyles.trackFill, { width: `${fraction * 100}%`, backgroundColor: trackColor || dc.accentCyan }]} />
          </View>
        </View>
        <TouchableOpacity style={sliderStyles.btn} onPress={increment} activeOpacity={0.6}>
          <Text style={sliderStyles.btnText}>+</Text>
        </TouchableOpacity>
        <TextInput
          style={sliderStyles.input}
          value={String(value)}
          onChangeText={handleTextChange}
          keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
          maxLength={4}
          selectTextOnFocus
        />
      </View>
    </View>
  );
}

const sliderStyles = StyleSheet.create({
  container: { marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center' },
  btn: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: dc.cardGlassStrong,
  },
  btnText: { fontSize: 20, fontWeight: '700', color: dc.textPrimary },
  trackOuter: { flex: 1, marginHorizontal: 10 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: dc.cardStrokeSoft },
  trackFill: { height: '100%', borderRadius: 4 },
  input: {
    width: 56, height: 36, borderWidth: 1, borderRadius: 10,
    textAlign: 'center', fontSize: 15, fontWeight: '600', marginLeft: 8,
    color: dc.textPrimary, borderColor: dc.cardStroke, backgroundColor: dc.cardGlass,
  },
});

/* ---------- Main Screen ---------- */
export default function AlertsScreen() {
  const themeCtx = useTheme();
  const settings = useSettings();
  const { configured, isSignedIn, isPremium, plan, loading: authLoading, signIn, signOut, signUp, user } = useAuth();
  const [activeTab, setActiveTab] = useState(0);

  const [thresholds, setThresholds] = useState(DEFAULT_THRESHOLDS);
  const [notifications, setNotifications] = useState(DEFAULT_NOTIFICATIONS);
  const [motorwaySubs, setMotorwaySubs] = useState({});
  const [pushSupported, setPushSupported] = useState(false);
  const [notificationState, setNotificationState] = useState({
    tone: 'neutral',
    title: 'Checking alert delivery',
    body: 'We are checking whether this device can receive alerts directly or save them locally for later.',
  });
  const [authMode, setAuthMode] = useState('signin');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    (async () => {
      const [t, n, mw] = await Promise.all([
        loadStoredThresholds(),
        loadStoredNotifications(),
        loadStoredMotorwaySubscriptions(),
      ]);
      setThresholds(t);
      setNotifications(n);
      setMotorwaySubs(mw);
    })();
  }, []);

  const handleAuthSubmit = useCallback(async () => {
    if (!authEmail.trim() || !authPassword.trim()) {
      setAuthError('Enter both email and password.');
      return;
    }
    setAuthBusy(true);
    setAuthError('');
    setAuthMessage('');
    try {
      if (authMode === 'signup') {
        const result = await signUp({ email: authEmail.trim(), password: authPassword });
        setAuthMessage(result?.message || 'Account created.');
        if (!result?.needsEmailConfirmation) setAuthPassword('');
      } else {
        await signIn({ email: authEmail.trim(), password: authPassword });
        setAuthMessage('Signed in successfully.');
        setAuthPassword('');
      }
    } catch (error) {
      setAuthError(error.message || 'Could not complete sign-in.');
    } finally {
      setAuthBusy(false);
    }
  }, [authEmail, authMode, authPassword, signIn, signUp]);

  const handleAuthSignOut = useCallback(async () => {
    setAuthBusy(true);
    setAuthError('');
    setAuthMessage('');
    try {
      await signOut();
      setAuthPassword('');
      setAuthMessage('Signed out.');
    } catch (error) {
      setAuthError(error.message || 'Could not sign out.');
    } finally {
      setAuthBusy(false);
    }
  }, [signOut]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (Platform.OS !== 'web' || !isWebPushSupported()) return;
      try {
        const subscribed = await hasPushSubscription();
        if (!cancelled) {
          setPushSupported(true);
          if (subscribed && isPremium) {
            const prefs = await loadStoredNotifications();
            syncWebPushPreferences(prefs).catch(() => {});
          }
        }
      } catch {
        if (!cancelled) setPushSupported(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isPremium]);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const enabledCount = Object.entries(notifications).filter(([key, value]) => {
        if (!value) return false;
        if (!isPremium && PREMIUM_NOTIFICATION_KEYS.has(key)) return false;
        return true;
      }).length;

      if (enabledCount === 0) {
        if (!cancelled) setNotificationState({ tone: 'neutral', title: 'No alerts selected yet', body: 'Turn on the alerts you care about and OutdoorAdvisor will watch for those conditions.' });
        return;
      }
      try {
        const local = await ensureLocalNotificationPermission({ prompt: false });
        if (cancelled) return;
        if (Platform.OS === 'web') {
          if (!isWebPushSupported()) { setNotificationState({ tone: 'soft', title: 'Saved on this browser only', body: 'Your alert choices are saved here, but this browser does not support the current push setup.' }); return; }
          const permission = getWebNotificationPermission();
          const subscribed = permission === 'granted' ? await hasPushSubscription().catch(() => false) : false;
          if (cancelled) return;
          if (permission === 'denied') { setNotificationState({ tone: 'warning', title: 'Browser notifications are blocked', body: 'Your alert choices are saved, but you will need to allow notifications in browser settings to receive live alerts.' }); return; }
          if (subscribed && isPremium) { setNotificationState({ tone: 'ready', title: 'Alerts are live on this browser', body: 'OutdoorAdvisor can send real web alerts here when conditions cross your thresholds.' }); return; }
          if (permission === 'granted' && isPremium) { setNotificationState({ tone: 'soft', title: 'Browser permission is ready', body: 'The next enabled alert will finish browser registration automatically.' }); return; }
          if (permission === 'granted' && !isPremium) { setNotificationState({ tone: 'soft', title: 'Alerts stay local on free', body: 'This browser can show local alerts, while cross-device browser push is reserved for premium accounts.' }); return; }
          setNotificationState({ tone: 'neutral', title: 'Permission will be requested when needed', body: 'Turn on any alert and OutdoorAdvisor will ask this browser for permission the first time it needs to deliver one.' });
          return;
        }
        if (local.granted) { setNotificationState({ tone: 'ready', title: 'Alerts are ready on this device', body: 'OutdoorAdvisor can deliver local alerts here when weather, AQI, or route conditions become important.' }); return; }
        if (local.blocked) { setNotificationState({ tone: 'warning', title: 'Device notifications are blocked', body: 'Your alert choices are saved, but you will need to enable notifications in system settings to receive them.' }); return; }
        setNotificationState({ tone: 'neutral', title: 'Alert preferences are saved', body: 'OutdoorAdvisor will ask for notification permission when it needs to deliver a real alert on this device.' });
      } catch {
        if (!cancelled) setNotificationState({ tone: 'soft', title: 'Alert preferences are saved', body: 'We could not confirm delivery status just now, but your chosen alerts are still saved on this device.' });
      }
    };
    refresh();
    return () => { cancelled = true; };
  }, [activeTab, isPremium, notifications]);

  const updateThreshold = useCallback((key, value) => {
    const updated = { ...thresholds, [key]: value };
    setThresholds(updated);
    saveStoredThresholds(updated).catch(() => {});
    registerNativePushToken({ prompt: false, thresholdsOverride: updated }).catch(() => {});
  }, [thresholds]);

  const updateNotification = useCallback(async (key, value) => {
    const updated = { ...notifications, [key]: value };
    setNotifications(updated);
    saveStoredNotifications(updated).catch(() => {});
    if (value) {
      ensureLocalNotificationPermission({ prompt: true }).catch(() => {});
      registerNativePushToken({ prompt: true, preferencesOverride: updated }).catch(() => {});
    } else {
      registerNativePushToken({ prompt: false, preferencesOverride: updated }).catch(() => {});
    }
    if (Platform.OS === 'web' && isWebPushSupported() && isPremium) {
      if (value) ensureWebPush(updated, { prompt: true }).catch(() => {});
      else syncWebPushPreferences(updated).catch(() => {});
    }
  }, [isPremium, notifications]);

  const updateMotorwaySub = useCallback((routeId, value) => {
    const updated = { ...motorwaySubs, [routeId]: value };
    setMotorwaySubs(updated);
    saveStoredMotorwaySubscriptions(updated).catch(() => {});
    registerNativePushToken({ prompt: false, motorwaySubscriptionsOverride: updated }).catch(() => {});
  }, [motorwaySubs]);

  /* ---------- Tab Bar ---------- */
  const renderTabBar = () => (
    <View style={styles.tabBar}>
      {TABS.map((tab, idx) => {
        const isActive = idx === activeTab;
        return (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, isActive && styles.tabActive]}
            onPress={() => setActiveTab(idx)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  /* ---------- Thresholds Tab ---------- */
  const renderThresholds = () => (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionDesc}>Set the levels at which you want to receive alerts. Values are saved automatically.</Text>
      {[
        { key: 'aqiAlert',  label: 'AQI Alert Level',   range: '50 - 500', min: 50,  max: 500, step: 10, trackColor: dc.accentRed },
        { key: 'pm25Alert', label: 'PM2.5 Alert Level',  range: '10 - 500', min: 10,  max: 500, step: 5,  trackColor: dc.accentOrange },
        { key: 'heatAlert', label: 'Heat Alert (°C)',     range: '30 - 55',  min: 30,  max: 55,  step: 1,  trackColor: dc.accentYellow },
        { key: 'coldAlert', label: 'Cold Alert (°C)',     range: '-10 - 15', min: -10, max: 15,  step: 1,  trackColor: dc.accentCyan },
      ].map(({ key, label, range, min, max, step, trackColor }) => (
        <GlassCard key={key} style={styles.sliderCard} contentStyle={styles.sliderContent}>
          <View style={styles.sliderHeader}>
            <Text style={styles.sliderLabel}>{label}</Text>
            <Text style={styles.sliderRange}>{range}</Text>
          </View>
          <CustomSlider
            value={thresholds[key]}
            min={min} max={max} step={step}
            onValueChange={(v) => updateThreshold(key, v)}
            trackColor={trackColor}
          />
        </GlassCard>
      ))}
    </ScrollView>
  );

  /* ---------- Notifications Tab ---------- */
  const renderNotifications = () => {
    const { mode, setThemeMode } = themeCtx;
    const themeModes = [
      { key: 'auto',  icon: '🔄', label: 'Auto',  desc: 'Follow system' },
      { key: 'light', icon: '☀️', label: 'Light', desc: 'Always light' },
      { key: 'dark',  icon: '🌙', label: 'Dark',  desc: 'Always dark' },
    ];
    const items = [
      { key: 'severeAqiWarnings',   label: 'Severe AQI Warnings',     desc: 'Important alerts when air quality becomes unhealthy enough to change outdoor plans.' },
      { key: 'dailySummary',        label: 'Daily Outdoor Summary',    desc: 'Receive a calm morning read on air, weather, and the outdoor mood in your city.' },
      { key: 'smartWalkNudges',     label: 'Smart Movement Nudges',    desc: 'Use your steps, weather, and AQI to spot a good time for a walk or suggest a better alternative.' },
      { key: 'smogAlerts',          label: 'Smog Season Alerts',       desc: 'Get notified when smog season conditions are detected.' },
      { key: 'rainAlerts',          label: 'Rain Alerts',              desc: 'Get notified when active rain could affect outdoor plans or driving.' },
      { key: 'thunderstormAlerts',  label: 'Thunderstorm Alerts',      desc: 'Important warnings for lightning and severe storm risk.' },
      { key: 'windAlerts',          label: 'Wind Alerts',              desc: 'Alerts when gusty conditions can disrupt outdoor activity or travel.' },
      { key: 'pollenAlerts',        label: 'High Pollen Alerts',       desc: 'Warnings for allergy-heavy days with elevated pollen levels.' },
      { key: 'heatAlerts',          label: 'Extreme Heat Alerts',      desc: 'Warnings when feels-like heat becomes unsafe for longer exposure.' },
      { key: 'fogWarnings',         label: 'Motorway Fog Warnings',    desc: 'Warnings for dangerous fog conditions on motorways.' },
      { key: 'routeClosureAlerts',  label: 'Major Route Closures',     desc: 'Important alerts for serious motorway and corridor closures.' },
      { key: 'motorwayAlerts',      label: 'Motorway Route Alerts',    desc: 'Server-monitored NHMP alerts for specific motorways you choose. Select routes below.' },
    ];

    return (
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {!isPremium && (
          <GlassCard tintColor={dc.infoGlass} borderColor={dc.infoStroke} style={styles.premiumBanner} contentStyle={styles.premiumBannerContent}>
            <Text style={styles.premiumBannerTitle}>Premium unlocks higher-value alerts</Text>
            <Text style={styles.premiumBannerBody}>Smog season, high pollen, motorway fog, major route closures, and browser push sync are reserved for premium accounts.</Text>
          </GlassCard>
        )}

        {/* Appearance */}
        <Text style={styles.groupLabel}>Appearance</Text>
        <GlassCard contentStyle={styles.themePickerContent}>
          <View style={styles.themePicker}>
            {themeModes.map((t) => {
              const isActive = mode === t.key;
              return (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.themeOption, isActive && styles.themeOptionActive]}
                  onPress={() => setThemeMode(t.key)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.themeIcon}>{t.icon}</Text>
                  <Text style={[styles.themeLabel, isActive && { color: dc.accentCyan }]}>{t.label}</Text>
                  <Text style={styles.themeDesc}>{t.desc}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </GlassCard>

        <Text style={[styles.groupLabel, { marginTop: 20 }]}>Health & Privacy</Text>
        <GlassCard style={styles.healthPrivacyCard} contentStyle={styles.healthPrivacyContent}>
          <Text style={styles.healthPrivacyTitle}>Smart walk nudges stay private on your device</Text>
          <Text style={styles.healthPrivacyBody}>
            OutdoorAdvisor reads today&apos;s steps, walking distance, and active calories from Apple Health only to time better local alerts. That data stays on your device, is not used for ads, and is not required to keep AQI, weather, or travel alerts working.
          </Text>
        </GlassCard>

        {/* Notification rows */}
        <Text style={[styles.groupLabel, { marginTop: 20 }]}>Alert Preferences</Text>
        {items.map((item) => {
          const isLocked = PREMIUM_NOTIFICATION_KEYS.has(item.key) && !isPremium;
          return (
            <GlassCard
              key={item.key}
              style={[styles.notifCard, isLocked && { opacity: 0.75 }]}
              contentStyle={styles.notifCardContent}
            >
              <View style={styles.notifInfo}>
                <View style={styles.notifLabelRow}>
                  <Text style={styles.notifLabel}>{item.label}</Text>
                  {isLocked && (
                    <View style={styles.premiumChip}>
                      <Text style={styles.premiumChipText}>Premium</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.notifDesc}>
                  {isLocked ? `${item.desc} Premium unlock: ${getPremiumFeatureCopy(item.key)}.` : item.desc}
                </Text>
              </View>
              <Switch
                value={isLocked ? false : notifications[item.key]}
                onValueChange={(v) => { if (!isLocked) updateNotification(item.key, v); }}
                disabled={isLocked}
                trackColor={{ false: dc.cardStrokeSoft, true: dc.accentCyan + '88' }}
                thumbColor={isLocked ? dc.textMuted : notifications[item.key] ? dc.accentCyan : dc.textMuted}
              />
            </GlassCard>
          );
        })}

        {/* ── Motorway Route Subscriptions (premium) ── */}
        <Text style={[styles.groupLabel, { marginTop: 20 }]}>
          Motorway Route Alerts
          {!isPremium && (
            <Text style={styles.groupLabelPremium}> · Premium</Text>
          )}
        </Text>
        <GlassCard
          style={[styles.motorwayCard, !isPremium && { opacity: 0.65 }]}
          contentStyle={styles.motorwayCardContent}
        >
          {!isPremium ? (
            <>
              <Text style={styles.motorwayLockedTitle}>Subscribe to specific motorways</Text>
              <Text style={styles.motorwayLockedDesc}>
                Get notified the moment a motorway you care about closes or reopens. Choose individual routes — M-1 through M-9 and the Hazara Expressway — and the server will watch NHMP advisories every 30 minutes and alert you instantly on any change. Premium only.
              </Text>
            </>
          ) : !notifications.motorwayAlerts ? (
            <>
              <Text style={styles.motorwayLockedTitle}>Enable Motorway Route Alerts first</Text>
              <Text style={styles.motorwayLockedDesc}>
                Turn on &ldquo;Motorway Route Alerts&rdquo; above, then select the routes you want to watch below.
              </Text>
            </>
          ) : (
            MOTORWAY_ROUTES.map((route, idx) => (
              <View
                key={route.id}
                style={[styles.motorwayRow, idx < MOTORWAY_ROUTES.length - 1 && styles.motorwayRowBorder]}
              >
                <View style={styles.motorwayInfo}>
                  <Text style={styles.motorwayLabel}>{route.label}</Text>
                  <Text style={styles.motorwayDesc}>{route.desc}</Text>
                </View>
                <Switch
                  value={!!motorwaySubs[route.id]}
                  onValueChange={(v) => updateMotorwaySub(route.id, v)}
                  trackColor={{ false: dc.cardStrokeSoft, true: dc.accentCyan + '88' }}
                  thumbColor={motorwaySubs[route.id] ? dc.accentCyan : dc.textMuted}
                />
              </View>
            ))
          )}
        </GlassCard>
      </ScrollView>
    );
  };

  /* ---------- Customize Tab ---------- */
  const renderCustomize = () => {
    const { units, windUnit, homeSections, fabActions, setUnits, setWindUnit, moveSection, toggleSection, resetHomeSections, toggleFabAction } = settings;
    const unitOptions = [{ key: 'metric', label: 'Metric', desc: '°C, mm' }, { key: 'imperial', label: 'Imperial', desc: '°F, in' }];
    const windOptions = [{ key: 'kmh', label: 'km/h' }, { key: 'mph', label: 'mph' }, { key: 'ms', label: 'm/s' }, { key: 'knots', label: 'knots' }];
    const enabledKeys = homeSections.filter((key) => isPremium || !PREMIUM_HOME_SECTION_KEYS.has(key));
    const disabledKeys = ALL_SECTION_KEYS.filter((k) => !enabledKeys.includes(k));

    return (
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.groupLabel}>Measurement Units</Text>
        <Text style={styles.sectionDesc}>Choose how temperature and precipitation are shown across the app.</Text>
        <GlassCard contentStyle={styles.themePickerContent}>
          <View style={styles.themePicker}>
            {unitOptions.map((u) => {
              const isActive = units === u.key;
              return (
                <TouchableOpacity
                  key={u.key}
                  style={[styles.themeOption, isActive && styles.themeOptionActive]}
                  onPress={() => setUnits(u.key)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.themeLabel, isActive && { color: dc.accentCyan }]}>{u.label}</Text>
                  <Text style={styles.themeDesc}>{u.desc}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </GlassCard>

        <Text style={[styles.groupLabel, { marginTop: 24 }]}>Wind Speed Unit</Text>
        <GlassCard contentStyle={styles.windPickerContent}>
          <View style={styles.windPicker}>
            {windOptions.map((w) => {
              const isActive = windUnit === w.key;
              return (
                <TouchableOpacity
                  key={w.key}
                  style={[styles.windBtn, isActive && styles.windBtnActive]}
                  onPress={() => setWindUnit(w.key)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.windBtnText, isActive && { color: dc.accentCyan }]}>{w.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </GlassCard>

        <Text style={[styles.groupLabel, { marginTop: 28 }]}>Home Screen Layout</Text>
        <Text style={styles.sectionDesc}>Reorder Home sections and hide the ones you do not need. Saved automatically.</Text>
        <GlassCard contentStyle={styles.layoutHintContent}>
          <Text style={styles.layoutHintBody}>Lead with live conditions first, then the decision answer, activities, and travel. Forecast, wind, and details can stay optional.</Text>
          <TouchableOpacity style={styles.resetBtn} onPress={resetHomeSections} activeOpacity={0.75}>
            <Text style={styles.resetBtnText}>Reset to Default</Text>
          </TouchableOpacity>
        </GlassCard>

        {enabledKeys.map((key, i) => {
          const meta = SECTION_META[key];
          const isFirst = i === 0;
          const isLast = i === enabledKeys.length - 1;
          return (
            <GlassCard key={key} style={styles.sectionItemCard} contentStyle={styles.sectionItemContent}>
              <Text style={styles.sectionItemIcon}>{meta.icon}</Text>
              <View style={styles.sectionItemInfo}>
                <View style={styles.sectionItemLabelRow}>
                  <Text style={styles.sectionItemLabel}>{meta.label}</Text>
                  {i < 2 && <View style={styles.topBadge}><Text style={styles.topBadgeText}>Top</Text></View>}
                </View>
                <Text style={styles.sectionItemDesc}>{meta.desc}</Text>
              </View>
              <View style={styles.sectionItemActions}>
                <TouchableOpacity
                  style={[styles.orderBtn, { opacity: isFirst ? 0.3 : 1 }]}
                  disabled={isFirst}
                  onPress={() => moveSection(i, i - 1)}
                >
                  <Text style={styles.orderBtnText}>▲</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.orderBtn, { opacity: isLast ? 0.3 : 1 }]}
                  disabled={isLast}
                  onPress={() => moveSection(i, i + 1)}
                >
                  <Text style={styles.orderBtnText}>▼</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.orderBtn, { backgroundColor: dc.dangerGlass }]}
                  onPress={() => toggleSection(key)}
                >
                  <Text style={[styles.orderBtnText, { color: dc.accentRed }]}>✕</Text>
                </TouchableOpacity>
              </View>
            </GlassCard>
          );
        })}

        {disabledKeys.length > 0 && (
          <>
            <Text style={[styles.groupLabel, { marginTop: 16, fontSize: 11 }]}>HIDDEN SECTIONS</Text>
            {disabledKeys.map((key) => {
              const meta = SECTION_META[key];
              const isLocked = PREMIUM_HOME_SECTION_KEYS.has(key) && !isPremium;
              return (
                <GlassCard key={key} style={[styles.sectionItemCard, { opacity: isLocked ? 0.9 : 0.6 }]} contentStyle={styles.sectionItemContent}>
                  <Text style={styles.sectionItemIcon}>{meta.icon}</Text>
                  <View style={styles.sectionItemInfo}>
                    <View style={styles.sectionItemLabelRow}>
                      <Text style={styles.sectionItemLabel}>{meta.label}</Text>
                      {isLocked && <View style={styles.premiumChip}><Text style={styles.premiumChipText}>Premium</Text></View>}
                    </View>
                    <Text style={styles.sectionItemDesc}>
                      {isLocked ? `${meta.desc} Premium unlock: ${getPremiumFeatureCopy(`${key}Section`)}.` : meta.desc}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.addBtn, { backgroundColor: isLocked ? dc.cardGlassStrong : dc.accentCyan }]}
                    onPress={() => { if (!isLocked) toggleSection(key); }}
                    disabled={isLocked}
                  >
                    <Text style={[styles.addBtnText, { color: isLocked ? dc.textMuted : dc.bgTop }]}>
                      {isLocked ? 'Premium' : '+ Add'}
                    </Text>
                  </TouchableOpacity>
                </GlassCard>
              );
            })}
          </>
        )}

        {/* FAB Quick Actions section hidden — FAB is currently disabled */}
      </ScrollView>
    );
  };

  /* ---------- About Tab ---------- */
  const renderAbout = () => <AboutTab />;

  /* ---------- Render ---------- */
  const tabContent = [renderThresholds, renderNotifications, renderCustomize, renderAbout];

  return (
    <ScreenGradient>
      <SafeAreaView style={styles.container}>
        <Text style={styles.screenTitle}>Settings</Text>

        {/* Account card */}
        <GlassCard style={styles.accountCard} contentStyle={styles.accountCardContent}>
          {isSignedIn ? (
            <View style={styles.accountSignedInRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.accountTitle}>Signed in</Text>
                <Text style={styles.accountBody}>{user?.email || 'Your account is connected on this device.'}</Text>
                <Text style={styles.accountPlan}>{isPremium ? 'Premium' : `Plan: ${plan || 'free'}`}</Text>
              </View>
              <TouchableOpacity
                style={[styles.accountBtn, { backgroundColor: dc.dangerGlass }]}
                onPress={handleAuthSignOut}
                activeOpacity={0.8}
                disabled={authBusy || authLoading}
              >
                {authBusy
                  ? <ActivityIndicator size="small" color={dc.accentRed} />
                  : <Text style={[styles.accountBtnText, { color: dc.accentRed }]}>Sign out</Text>}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.accountPanel}>
              <View style={styles.accountHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.accountTitle}>Optional account</Text>
                  <Text style={styles.accountBody}>Create an account to sync preferences across devices later. The app can still be used without signing in.</Text>
                </View>
                <View style={styles.authModeSwitch}>
                  {[{ key: 'signin', label: 'Sign in' }, { key: 'signup', label: 'Create' }].map((item) => {
                    const active = authMode === item.key;
                    return (
                      <TouchableOpacity
                        key={item.key}
                        style={[styles.authModeBtn, active && styles.authModeBtnActive]}
                        onPress={() => { setAuthMode(item.key); setAuthError(''); setAuthMessage(''); }}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.authModeBtnText, active && { color: dc.accentCyan }]}>{item.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              <TextInput
                value={authEmail}
                onChangeText={setAuthEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder="Email"
                placeholderTextColor={dc.textMuted}
                style={styles.authInput}
              />
              <TextInput
                value={authPassword}
                onChangeText={setAuthPassword}
                secureTextEntry
                autoCapitalize="none"
                placeholder="Password"
                placeholderTextColor={dc.textMuted}
                style={styles.authInput}
              />
              {!!authError && <Text style={styles.authError}>{authError}</Text>}
              {!!authMessage && <Text style={styles.authMessage}>{authMessage}</Text>}
              <TouchableOpacity
                style={[styles.accountBtn, styles.authSubmitBtn, { backgroundColor: dc.accentCyan }]}
                onPress={handleAuthSubmit}
                activeOpacity={0.85}
                disabled={authBusy || authLoading}
              >
                {authBusy
                  ? <ActivityIndicator size="small" color={dc.bgTop} />
                  : <Text style={[styles.accountBtnText, { color: dc.bgTop }]}>{authMode === 'signup' ? 'Create account' : 'Sign in'}</Text>}
              </TouchableOpacity>
            </View>
          )}
        </GlassCard>

        {renderTabBar()}
        <View style={{ flex: 1 }}>
          {tabContent[activeTab]()}
        </View>
      </SafeAreaView>
    </ScreenGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  screenTitle: {
    fontSize: 34, fontWeight: '800', color: dc.textPrimary,
    letterSpacing: -0.8, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 10,
  },

  accountCard: { marginHorizontal: 20, marginBottom: 8 },
  accountCardContent: { padding: 16 },
  accountSignedInRow: { flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%' },
  accountPanel: { width: '100%' },
  accountHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  accountTitle: { fontSize: 15, fontWeight: '700', color: dc.textPrimary, marginBottom: 4 },
  accountBody: { fontSize: 13, color: dc.textSecondary, lineHeight: 18 },
  accountPlan: { fontSize: 12, fontWeight: '700', color: dc.accentCyan, marginTop: 8, textTransform: 'capitalize' },
  accountBtn: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, alignItems: 'center', justifyContent: 'center', minWidth: 100 },
  accountBtnText: { fontSize: 12, fontWeight: '700' },
  authModeSwitch: { flexDirection: 'row', backgroundColor: dc.cardGlass, borderRadius: 12, padding: 4 },
  authModeBtn: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  authModeBtnActive: { backgroundColor: dc.accentCyanBg },
  authModeBtnText: { fontSize: 12, fontWeight: '700', color: dc.textSecondary },
  authInput: {
    width: '100%', borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
    marginBottom: 10, color: dc.textPrimary, borderColor: dc.cardStroke,
    backgroundColor: dc.cardGlass,
  },
  authError: { fontSize: 12, lineHeight: 18, marginBottom: 8, color: dc.accentRed },
  authMessage: { fontSize: 12, lineHeight: 18, marginBottom: 8, color: dc.accentGreen },
  authSubmitBtn: { minWidth: 0, alignSelf: 'flex-start', paddingHorizontal: 18 },

  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: dc.cardStrokeSoft,
    backgroundColor: 'transparent',
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: dc.accentCyan },
  tabText: { fontSize: 13, fontWeight: '500', color: dc.textMuted },
  tabTextActive: { fontWeight: '700', color: dc.accentCyan },

  scrollContent: { padding: 20, paddingBottom: 40 },
  sectionDesc: { fontSize: 15, color: dc.textSecondary, marginBottom: 16, lineHeight: 22 },
  groupLabel: { fontSize: 13, fontWeight: '800', color: dc.textMuted, letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 12 },

  sliderCard: { marginBottom: 14 },
  sliderContent: { padding: 16 },
  sliderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sliderLabel: { fontSize: 15, fontWeight: '600', color: dc.textPrimary },
  sliderRange: { fontSize: 12, color: dc.textMuted },

  premiumBanner: { marginBottom: 16 },
  premiumBannerContent: { padding: 14 },
  premiumBannerTitle: { fontSize: 15, fontWeight: '700', color: dc.textPrimary, marginBottom: 6 },
  premiumBannerBody: { fontSize: 13, color: dc.textSecondary, lineHeight: 18 },

  themePickerContent: { padding: 8 },
  themePicker: { flexDirection: 'row', gap: 8 },
  themeOption: { flex: 1, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 4, borderRadius: 12, borderWidth: 1.5, borderColor: 'transparent' },
  themeOptionActive: { backgroundColor: dc.accentCyanBg, borderColor: dc.accentCyan },
  themeIcon: { fontSize: 22, marginBottom: 6 },
  themeLabel: { fontSize: 13, fontWeight: '700', color: dc.textPrimary, marginBottom: 2 },
  themeDesc: { fontSize: 10, color: dc.textMuted, textAlign: 'center' },

  windPickerContent: { padding: 8 },
  windPicker: { flexDirection: 'row', gap: 6 },
  windBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: 'transparent' },
  windBtnActive: { backgroundColor: dc.accentCyanBg, borderColor: dc.accentCyan },
  windBtnText: { fontSize: 13, fontWeight: '700', color: dc.textPrimary },

  layoutHintContent: { padding: 16 },
  layoutHintBody: { fontSize: 13, color: dc.textSecondary, lineHeight: 18 },
  resetBtn: { alignSelf: 'flex-start', marginTop: 12, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: dc.infoGlass },
  resetBtnText: { fontSize: 12, fontWeight: '700', color: dc.accentBlue },

  notifCard: { marginBottom: 10 },
  notifCardContent: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  healthPrivacyCard: { marginBottom: 4 },
  healthPrivacyContent: { padding: 16 },
  healthPrivacyTitle: { fontSize: 15, fontWeight: '700', color: dc.textPrimary, marginBottom: 8 },
  healthPrivacyBody: { fontSize: 13, lineHeight: 20, color: dc.textSecondary },
  notifInfo: { flex: 1, marginRight: 12 },
  notifLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' },
  notifLabel: { fontSize: 15, fontWeight: '600', color: dc.textPrimary },
  fabActionIcon: { fontSize: 16 },
  notifDesc: { fontSize: 12, color: dc.textSecondary, lineHeight: 18 },
  premiumChip: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: dc.accentCyanBg },
  premiumChipText: { fontSize: 10, fontWeight: '700', color: dc.accentCyan, letterSpacing: 0.4, textTransform: 'uppercase' },
  groupLabelPremium: { color: dc.accentCyan, fontWeight: '700', textTransform: 'none', letterSpacing: 0 },
  motorwayCard: { marginBottom: 10 },
  motorwayCardContent: { padding: 14 },
  motorwayLockedTitle: { fontSize: 14, fontWeight: '700', color: dc.textPrimary, marginBottom: 6 },
  motorwayLockedDesc: { fontSize: 12, color: dc.textSecondary, lineHeight: 18 },
  motorwayRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  motorwayRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: dc.cardStroke },
  motorwayInfo: { flex: 1, marginRight: 12 },
  motorwayLabel: { fontSize: 15, fontWeight: '700', color: dc.textPrimary },
  motorwayDesc: { fontSize: 12, color: dc.textSecondary, marginTop: 1 },

  sectionItemCard: { marginBottom: 10 },
  sectionItemContent: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  sectionItemIcon: { fontSize: 24, marginRight: 12 },
  sectionItemInfo: { flex: 1, marginRight: 8 },
  sectionItemLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  sectionItemLabel: { fontSize: 15, fontWeight: '700', color: dc.textPrimary },
  sectionItemDesc: { fontSize: 12, color: dc.textSecondary },
  topBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: dc.accentCyanBg },
  topBadgeText: { fontSize: 10, fontWeight: '800', color: dc.accentCyan, textTransform: 'uppercase', letterSpacing: 0.4 },
  sectionItemActions: { flexDirection: 'row', gap: 6 },
  orderBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: dc.cardGlassStrong },
  orderBtnText: { fontSize: 13, fontWeight: '700', color: dc.accentCyan },
  addBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  addBtnText: { fontSize: 12, fontWeight: '700' },

});
