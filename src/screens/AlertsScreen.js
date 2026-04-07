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
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import typography from '../theme/typography';
import {
  ensureWebPush,
  getWebNotificationPermission,
  hasPushSubscription,
  isWebPushSupported,
  syncWebPushPreferences,
} from '../utils/webPush';
import {
  DEFAULT_NOTIFICATIONS,
  DEFAULT_THRESHOLDS,
  loadStoredNotifications,
  loadStoredThresholds,
  saveStoredNotifications,
  saveStoredThresholds,
} from '../utils/alertPreferences';
import { ensureLocalNotificationPermission } from '../utils/alertNotifications';

const TABS = ['Thresholds', 'Notifications', 'Customize', 'About'];

const SECTION_META = {
  decision: { label: 'Outdoor Decision', icon: '🧭', desc: 'Plain-language go / go with care / limit exposure answer' },
  travel: { label: 'Travel Quick Checks', icon: '🛣️', desc: 'Fast access to Murree and M2 route conditions' },
  aqi: { label: 'Live Conditions', icon: '🌤️', desc: 'Primary live conditions card with AQI and targeted quick taps' },
  pollen: { label: 'Pollen Level', icon: '🌼', desc: 'Separate allergy and pollen snapshot for users who want it visible' },
  wind: { label: 'Wind', icon: '💨', desc: 'Wind speed, gusts & direction' },
  details: { label: 'Current Details', icon: '📊', desc: 'Feels like, PM2.5, and temperature summary cards' },
  forecast: { label: '7-Day Forecast', icon: '📅', desc: 'Weekly weather outlook' },
  activities: { label: 'Activity Advisory', icon: '🏃', desc: 'Outdoor activity recommendations' },
};
const ALL_SECTION_KEYS = Object.keys(SECTION_META);

/* ---------- Custom Slider ---------- */
function CustomSlider({ value, min, max, step = 1, onValueChange, trackColor, thumbColor, colors }) {
  const clamp = (v) => Math.min(max, Math.max(min, v));

  const decrement = () => onValueChange(clamp(value - step));
  const increment = () => onValueChange(clamp(value + step));

  const handleTextChange = (text) => {
    const num = parseInt(text, 10);
    if (!isNaN(num)) {
      onValueChange(clamp(num));
    } else if (text === '' || text === '-') {
      // allow typing negative sign for cold
    }
  };

  const fraction = (value - min) / (max - min);

  return (
    <View style={sliderStyles.container}>
      <View style={sliderStyles.row}>
        <TouchableOpacity
          style={[sliderStyles.btn, { backgroundColor: colors.border }]}
          onPress={decrement}
          activeOpacity={0.6}
        >
          <Text style={[sliderStyles.btnText, { color: colors.text }]}>-</Text>
        </TouchableOpacity>

        <View style={sliderStyles.trackOuter}>
          <View style={[sliderStyles.track, { backgroundColor: colors.border }]}>
            <View
              style={[
                sliderStyles.trackFill,
                { width: `${fraction * 100}%`, backgroundColor: trackColor || colors.primary },
              ]}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[sliderStyles.btn, { backgroundColor: colors.border }]}
          onPress={increment}
          activeOpacity={0.6}
        >
          <Text style={[sliderStyles.btnText, { color: colors.text }]}>+</Text>
        </TouchableOpacity>

        <TextInput
          style={[
            sliderStyles.input,
            { color: colors.text, borderColor: colors.border, backgroundColor: colors.card },
          ]}
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
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontSize: 20, fontWeight: '700' },
  trackOuter: { flex: 1, marginHorizontal: 10 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  trackFill: { height: '100%', borderRadius: 4 },
  input: {
    width: 56,
    height: 36,
    borderWidth: 1,
    borderRadius: 10,
    textAlign: 'center',
    fontSize: typography.body,
    fontWeight: '600',
    marginLeft: 8,
  },
});

/* ---------- Main Screen ---------- */
export default function AlertsScreen() {
  const themeCtx = useTheme();
  const { colors } = themeCtx;
  const settings = useSettings();
  const { configured, isSignedIn, loading: authLoading, signIn, signOut, signUp, user } = useAuth();
  const [activeTab, setActiveTab] = useState(0);

  // Thresholds state
  const [thresholds, setThresholds] = useState(DEFAULT_THRESHOLDS);

  // Notifications state
  const [notifications, setNotifications] = useState(DEFAULT_NOTIFICATIONS);
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

  // Load persisted data on mount
  useEffect(() => {
    (async () => {
      setThresholds(await loadStoredThresholds());
      setNotifications(await loadStoredNotifications());
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
        const result = await signUp({
          email: authEmail.trim(),
          password: authPassword,
        });
        setAuthMessage(result?.message || 'Account created.');
        if (!result?.needsEmailConfirmation) {
          setAuthPassword('');
        }
      } else {
        await signIn({
          email: authEmail.trim(),
          password: authPassword,
        });
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
          if (subscribed) {
            const prefs = await loadStoredNotifications();
            syncWebPushPreferences(prefs).catch(() => {});
          }
        }
      } catch {
        if (!cancelled) setPushSupported(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const refreshNotificationState = async () => {
      const enabledCount = Object.values(notifications).filter(Boolean).length;

      if (enabledCount === 0) {
        if (!cancelled) {
          setNotificationState({
            tone: 'neutral',
            title: 'No alerts selected yet',
            body: 'Turn on the alerts you care about and OutdoorAdvisor will watch for those conditions.',
          });
        }
        return;
      }

      try {
        const local = await ensureLocalNotificationPermission({ prompt: false });
        if (cancelled) return;

        if (Platform.OS === 'web') {
          if (!isWebPushSupported()) {
            setNotificationState({
              tone: 'soft',
              title: 'Saved on this browser only',
              body: 'Your alert choices are saved here, but this browser does not support the current push setup.',
            });
            return;
          }

          const permission = getWebNotificationPermission();
          const subscribed = permission === 'granted' ? await hasPushSubscription().catch(() => false) : false;
          if (cancelled) return;

          if (permission === 'denied') {
            setNotificationState({
              tone: 'warning',
              title: 'Browser notifications are blocked',
              body: 'Your alert choices are saved, but you will need to allow notifications in browser settings to receive live alerts.',
            });
            return;
          }

          if (subscribed) {
            setNotificationState({
              tone: 'ready',
              title: 'Alerts are live on this browser',
              body: 'OutdoorAdvisor can send real web alerts here when conditions cross your thresholds.',
            });
            return;
          }

          if (permission === 'granted') {
            setNotificationState({
              tone: 'soft',
              title: 'Browser permission is ready',
              body: 'The next enabled alert will finish browser registration automatically and keep this device in sync.',
            });
            return;
          }

          setNotificationState({
            tone: 'neutral',
            title: 'Permission will be requested when needed',
            body: 'Turn on any alert and OutdoorAdvisor will ask this browser for permission the first time it needs to deliver one.',
          });
          return;
        }

        if (local.granted) {
          setNotificationState({
            tone: 'ready',
            title: 'Alerts are ready on this device',
            body: 'OutdoorAdvisor can deliver local alerts here when weather, AQI, or route conditions become important.',
          });
          return;
        }

        if (local.blocked) {
          setNotificationState({
            tone: 'warning',
            title: 'Device notifications are blocked',
            body: 'Your alert choices are saved, but you will need to enable notifications in system settings to receive them.',
          });
          return;
        }

        setNotificationState({
          tone: 'neutral',
          title: 'Alert preferences are saved',
          body: 'OutdoorAdvisor will ask for notification permission when it needs to deliver a real alert on this device.',
        });
      } catch {
        if (!cancelled) {
          setNotificationState({
            tone: 'soft',
            title: 'Alert preferences are saved',
            body: 'We could not confirm delivery status just now, but your chosen alerts are still saved on this device.',
          });
        }
      }
    };

    refreshNotificationState();

    return () => {
      cancelled = true;
    };
  }, [activeTab, notifications]);

  // Persist thresholds
  const updateThreshold = useCallback(
    (key, value) => {
      const updated = { ...thresholds, [key]: value };
      setThresholds(updated);
      saveStoredThresholds(updated).catch(() => {});
    },
    [thresholds]
  );

  // Persist notifications
  const updateNotification = useCallback(
    async (key, value) => {
      const updated = { ...notifications, [key]: value };
      setNotifications(updated);
      saveStoredNotifications(updated).catch(() => {});

      if (value) {
        ensureLocalNotificationPermission({ prompt: true }).catch(() => {});
      }

      if (Platform.OS === 'web' && isWebPushSupported()) {
        if (value) {
          ensureWebPush(updated, { prompt: true }).catch(() => {});
        } else {
          syncWebPushPreferences(updated).catch(() => {});
        }
      }
    },
    [notifications]
  );

  /* ---------- Tab Bar ---------- */
  const renderTabBar = () => (
    <View style={[styles.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
      {TABS.map((tab, idx) => {
        const isActive = idx === activeTab;
        return (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, isActive && { borderBottomColor: colors.primary, borderBottomWidth: 3 }]}
            onPress={() => setActiveTab(idx)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.tabText,
                { color: isActive ? colors.primary : colors.textSecondary },
                isActive && styles.tabTextActive,
              ]}
            >
              {tab}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  /* ---------- Thresholds Tab ---------- */
  const renderThresholds = () => (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
        Set the levels at which you want to receive alerts. Values are saved automatically.
      </Text>

      {/* AQI Alert */}
      <View style={[styles.sliderCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.sliderHeader}>
          <Text style={[styles.sliderLabel, { color: colors.text }]}>AQI Alert Level</Text>
          <Text style={[styles.sliderRange, { color: colors.textSecondary }]}>50 - 500</Text>
        </View>
        <CustomSlider
          value={thresholds.aqiAlert}
          min={50}
          max={500}
          step={10}
          onValueChange={(v) => updateThreshold('aqiAlert', v)}
          trackColor="#EF4444"
          colors={colors}
        />
      </View>

      {/* PM2.5 Alert */}
      <View style={[styles.sliderCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.sliderHeader}>
          <Text style={[styles.sliderLabel, { color: colors.text }]}>PM2.5 Alert Level</Text>
          <Text style={[styles.sliderRange, { color: colors.textSecondary }]}>10 - 500</Text>
        </View>
        <CustomSlider
          value={thresholds.pm25Alert}
          min={10}
          max={500}
          step={5}
          onValueChange={(v) => updateThreshold('pm25Alert', v)}
          trackColor="#F97316"
          colors={colors}
        />
      </View>

      {/* Heat Alert */}
      <View style={[styles.sliderCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.sliderHeader}>
          <Text style={[styles.sliderLabel, { color: colors.text }]}>Heat Alert (°C)</Text>
          <Text style={[styles.sliderRange, { color: colors.textSecondary }]}>30 - 55</Text>
        </View>
        <CustomSlider
          value={thresholds.heatAlert}
          min={30}
          max={55}
          step={1}
          onValueChange={(v) => updateThreshold('heatAlert', v)}
          trackColor="#EAB308"
          colors={colors}
        />
      </View>

      {/* Cold Alert */}
      <View style={[styles.sliderCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.sliderHeader}>
          <Text style={[styles.sliderLabel, { color: colors.text }]}>Cold Alert (°C)</Text>
          <Text style={[styles.sliderRange, { color: colors.textSecondary }]}>-10 - 15</Text>
        </View>
        <CustomSlider
          value={thresholds.coldAlert}
          min={-10}
          max={15}
          step={1}
          onValueChange={(v) => updateThreshold('coldAlert', v)}
          trackColor="#06B6D4"
          colors={colors}
        />
      </View>
    </ScrollView>
  );

  /* ---------- Notifications Tab ---------- */
  const renderNotifications = () => {
    const { mode, setThemeMode } = themeCtx;
    const themeModes = [
      { key: 'auto', icon: '🔄', label: 'Auto', desc: 'Follow system setting' },
      { key: 'light', icon: '☀️', label: 'Light', desc: 'Always light mode' },
      { key: 'dark', icon: '🌙', label: 'Dark', desc: 'Always dark mode' },
    ];

    const items = [
      { key: 'severeAqiWarnings', label: 'Severe AQI Warnings', desc: 'Important alerts when air quality becomes unhealthy enough to change outdoor plans.' },
      { key: 'dailySummary', label: 'Daily AQI Summary', desc: 'Receive a morning summary of air quality in your city.' },
      { key: 'smogAlerts', label: 'Smog Season Alerts', desc: 'Get notified when smog season conditions are detected.' },
      { key: 'rainAlerts', label: 'Rain Alerts', desc: 'Get notified when active rain could affect outdoor plans or driving.' },
      { key: 'thunderstormAlerts', label: 'Thunderstorm Alerts', desc: 'Important warnings for lightning and severe storm risk.' },
      { key: 'windAlerts', label: 'Wind Alerts', desc: 'Alerts when gusty conditions can disrupt outdoor activity or travel.' },
      { key: 'pollenAlerts', label: 'High Pollen Alerts', desc: 'Warnings for allergy-heavy days with elevated pollen levels.' },
      { key: 'heatAlerts', label: 'Extreme Heat Alerts', desc: 'Warnings when feels-like heat becomes unsafe for longer exposure.' },
      { key: 'fogWarnings', label: 'Motorway Fog Warnings', desc: 'Warnings for dangerous fog conditions on motorways.' },
      { key: 'routeClosureAlerts', label: 'Major Route Closures', desc: 'Important alerts for serious motorway and corridor closures.' },
    ];

    return (
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Theme Mode Picker */}
        <Text style={[styles.sectionLabel, { color: colors.text }]}>Appearance</Text>
        <View style={[styles.themePicker, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {themeModes.map((t) => {
            const isActive = mode === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                style={[
                  styles.themeOption,
                  isActive && { backgroundColor: colors.primary + '1A' },
                  isActive && { borderColor: colors.primary, borderWidth: 1.5 },
                ]}
                onPress={() => setThemeMode(t.key)}
                activeOpacity={0.7}
              >
                <Text style={styles.themeIcon}>{t.icon}</Text>
                <Text style={[styles.themeLabel, { color: isActive ? colors.primary : colors.text }]}>
                  {t.label}
                </Text>
                <Text style={[styles.themeDesc, { color: colors.textSecondary }]}>{t.desc}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {items.map((item) => (
          <View
            key={item.key}
            style={[styles.notifRow, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <View style={styles.notifInfo}>
              <Text style={[styles.notifLabel, { color: colors.text }]}>{item.label}</Text>
              <Text style={[styles.notifDesc, { color: colors.textSecondary }]}>{item.desc}</Text>
            </View>
            <Switch
              value={notifications[item.key]}
              onValueChange={(v) => updateNotification(item.key, v)}
              trackColor={{ false: colors.border, true: colors.primary + '77' }}
              thumbColor={notifications[item.key] ? colors.primary : '#ccc'}
            />
          </View>
        ))}
      </ScrollView>
    );
  };

  /* ---------- Customize Tab ---------- */
  const renderCustomize = () => {
    const { units, windUnit, homeSections, setUnits, setWindUnit, moveSection, toggleSection, resetHomeSections } = settings;

    const unitOptions = [
      { key: 'metric', label: 'Metric', desc: '°C, mm' },
      { key: 'imperial', label: 'Imperial', desc: '°F, in' },
    ];
    const windOptions = [
      { key: 'kmh', label: 'km/h' },
      { key: 'mph', label: 'mph' },
      { key: 'ms', label: 'm/s' },
      { key: 'knots', label: 'knots' },
    ];

    const enabledKeys = homeSections;
    const disabledKeys = ALL_SECTION_KEYS.filter((k) => !enabledKeys.includes(k));

    return (
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Units */}
        <Text style={[styles.sectionLabel, { color: colors.text }]}>Measurement Units</Text>
        <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
          Choose how temperature and precipitation are shown across the app.
        </Text>
        <View style={[styles.themePicker, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {unitOptions.map((u) => {
            const isActive = units === u.key;
            return (
              <TouchableOpacity
                key={u.key}
                style={[
                  styles.themeOption,
                  isActive && { backgroundColor: colors.primary + '1A', borderColor: colors.primary, borderWidth: 1.5 },
                ]}
                onPress={() => setUnits(u.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.themeLabel, { color: isActive ? colors.primary : colors.text }]}>{u.label}</Text>
                <Text style={[styles.themeDesc, { color: colors.textSecondary }]}>{u.desc}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Wind Unit */}
        <Text style={[styles.sectionLabel, { color: colors.text, marginTop: 24 }]}>Wind Speed Unit</Text>
        <View style={[styles.windUnitRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {windOptions.map((w) => {
            const isActive = windUnit === w.key;
            return (
              <TouchableOpacity
                key={w.key}
                style={[
                  styles.windUnitBtn,
                  isActive && { backgroundColor: colors.primary + '1A', borderColor: colors.primary, borderWidth: 1.5 },
                ]}
                onPress={() => setWindUnit(w.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.windUnitText, { color: isActive ? colors.primary : colors.text }]}>{w.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Home Layout */}
        <Text style={[styles.sectionLabel, { color: colors.text, marginTop: 28 }]}>Home Screen Layout</Text>
        <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
          Reorder the important Home stacks and hide the ones you do not need. Your current setup is saved automatically.
        </Text>
        <View style={[styles.layoutHintCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.layoutHintTitle, { color: colors.text }]}>Recommended order</Text>
          <Text style={[styles.layoutHintBody, { color: colors.textSecondary }]}>
            Lead with live conditions first, then the decision answer, activities, and travel. Forecast, wind, and details can stay optional.
          </Text>
          <TouchableOpacity
            style={[styles.resetLayoutBtn, { backgroundColor: colors.primary + '15' }]}
            onPress={resetHomeSections}
            activeOpacity={0.75}
          >
            <Text style={[styles.resetLayoutBtnText, { color: colors.primary }]}>Reset to Recommended</Text>
          </TouchableOpacity>
        </View>

        {enabledKeys.map((key, i) => {
          const meta = SECTION_META[key];
          const isFirst = i === 0;
          const isLast = i === enabledKeys.length - 1;
          return (
            <View key={key} style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={styles.sectionCardIcon}>{meta.icon}</Text>
              <View style={styles.sectionCardInfo}>
                <View style={styles.sectionCardLabelRow}>
                  <Text style={[styles.sectionCardLabel, { color: colors.text }]}>{meta.label}</Text>
                  {i < 2 && (
                    <View style={[styles.priorityBadge, { backgroundColor: colors.primary + '15' }]}>
                      <Text style={[styles.priorityBadgeText, { color: colors.primary }]}>Top</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.sectionCardDesc, { color: colors.textSecondary }]}>{meta.desc}</Text>
              </View>
              <View style={styles.sectionCardActions}>
                <TouchableOpacity
                  style={[styles.orderBtn, { backgroundColor: isFirst ? colors.border + '55' : colors.primary + '22', opacity: isFirst ? 0.4 : 1 }]}
                  disabled={isFirst}
                  onPress={() => moveSection(i, i - 1)}
                >
                  <Text style={[styles.orderBtnText, { color: colors.primary }]}>▲</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.orderBtn, { backgroundColor: isLast ? colors.border + '55' : colors.primary + '22', opacity: isLast ? 0.4 : 1 }]}
                  disabled={isLast}
                  onPress={() => moveSection(i, i + 1)}
                >
                  <Text style={[styles.orderBtnText, { color: colors.primary }]}>▼</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.orderBtn, { backgroundColor: '#EF4444' + '22' }]}
                  onPress={() => toggleSection(key)}
                >
                  <Text style={[styles.orderBtnText, { color: '#EF4444' }]}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {disabledKeys.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: 16, fontSize: 13 }]}>HIDDEN SECTIONS</Text>
            {disabledKeys.map((key) => {
              const meta = SECTION_META[key];
              return (
                <View key={key} style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border, opacity: 0.6 }]}>
                  <Text style={styles.sectionCardIcon}>{meta.icon}</Text>
                  <View style={styles.sectionCardInfo}>
                    <Text style={[styles.sectionCardLabel, { color: colors.text }]}>{meta.label}</Text>
                    <Text style={[styles.sectionCardDesc, { color: colors.textSecondary }]}>{meta.desc}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.addBtn, { backgroundColor: colors.primary }]}
                    onPress={() => toggleSection(key)}
                  >
                    <Text style={styles.addBtnText}>+ Add</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    );
  };

  /* ---------- About Tab ---------- */
  const renderAbout = () => {
    const platformHighlights = [
      { label: 'Coverage', value: 'Pakistan' },
      { label: 'Focus', value: 'Outdoor decisions' },
      { label: 'Experience', value: 'Mobile-first' },
    ];

    return (
      <ScrollView contentContainerStyle={[styles.scrollContent, styles.aboutContainer]} showsVerticalScrollIndicator={false}>
        <View style={[styles.aboutHero, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={styles.aboutEmoji}>🌬️</Text>
          <Text style={[styles.aboutAppName, { color: colors.text }]}>OutdoorAdvisor</Text>
          <Text style={[styles.aboutVersion, { color: colors.textSecondary }]}>Version 1.0.0</Text>
          <Text style={[styles.aboutTagline, { color: colors.accent }]}>
            Your smart guide to outdoor safety with practical local context, live conditions, and travel checks across Pakistan.
          </Text>
          <View style={styles.aboutHighlightRow}>
            {platformHighlights.map((item) => (
              <View key={item.label} style={[styles.aboutHighlightChip, { backgroundColor: colors.primary + '12' }]}>
                <Text style={[styles.aboutHighlightLabel, { color: colors.textSecondary }]}>{item.label}</Text>
                <Text style={[styles.aboutHighlightValue, { color: colors.text }]}>{item.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.aboutCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.aboutCardTitle, { color: colors.primary }]}>OutdoorAdvisor</Text>
          <Text style={[styles.aboutBodyText, { color: colors.text }]}>
            OutdoorAdvisor helps people make better daily outdoor decisions with a calm, practical view of current conditions, activity timing, and important travel context.
          </Text>
          <Text style={[styles.aboutBodyText, { color: colors.text, marginTop: 12 }]}>
            The product is designed to keep guidance simple: what conditions mean right now, when to go, when to be careful, and which routes deserve a second look before leaving.
          </Text>
          <Text style={[styles.aboutBodyText, { color: colors.text, marginTop: 12 }]}>
            Built in Pakistan for Pakistan, with a strong focus on clarity, reliability, and a mobile-first experience that feels easy to trust at a glance.
          </Text>
        </View>
      </ScrollView>
    );
  };

  /* ---------- Render ---------- */
  const tabContent = [renderThresholds, renderNotifications, renderCustomize, renderAbout];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.screenTitle, { color: colors.text }]}>Settings</Text>
      <View style={[styles.accountCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {!configured ? (
          <View style={styles.accountCopy}>
            <Text style={[styles.accountTitle, { color: colors.text }]}>Account sign-in</Text>
            <Text style={[styles.accountBody, { color: colors.textSecondary }]}>
              Sign-in UI is ready. Add `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to enable real accounts.
            </Text>
          </View>
        ) : isSignedIn ? (
          <>
            <View style={styles.accountCopy}>
              <Text style={[styles.accountTitle, { color: colors.text }]}>Signed in</Text>
              <Text style={[styles.accountBody, { color: colors.textSecondary }]}>
                {user?.email || 'Your account is connected on this device.'}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.accountBtn, { backgroundColor: '#EF4444' + '18' }]}
              onPress={handleAuthSignOut}
              activeOpacity={0.8}
              disabled={authBusy || authLoading}
            >
              {authBusy ? (
                <ActivityIndicator size="small" color="#EF4444" />
              ) : (
                <Text style={[styles.accountBtnText, { color: '#EF4444' }]}>Sign out</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.accountPanel}>
            <View style={styles.accountHeaderRow}>
              <View style={styles.accountCopy}>
                <Text style={[styles.accountTitle, { color: colors.text }]}>Optional account</Text>
                <Text style={[styles.accountBody, { color: colors.textSecondary }]}>
                  Create an account to sync preferences across devices later. The app can still be used without signing in.
                </Text>
              </View>
              <View style={[styles.authModeSwitch, { backgroundColor: colors.background }]}>
                {[
                  { key: 'signin', label: 'Sign in' },
                  { key: 'signup', label: 'Create' },
                ].map((item) => {
                  const active = authMode === item.key;
                  return (
                    <TouchableOpacity
                      key={item.key}
                      style={[
                        styles.authModeButton,
                        active && { backgroundColor: colors.primary + '18' },
                      ]}
                      onPress={() => {
                        setAuthMode(item.key);
                        setAuthError('');
                        setAuthMessage('');
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.authModeText, { color: active ? colors.primary : colors.textSecondary }]}>
                        {item.label}
                      </Text>
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
              placeholderTextColor={colors.textSecondary}
              style={[styles.authInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
            />
            <TextInput
              value={authPassword}
              onChangeText={setAuthPassword}
              secureTextEntry
              autoCapitalize="none"
              placeholder="Password"
              placeholderTextColor={colors.textSecondary}
              style={[styles.authInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
            />
            {!!authError && <Text style={[styles.authError, { color: '#DC2626' }]}>{authError}</Text>}
            {!!authMessage && <Text style={[styles.authMessage, { color: colors.primary }]}>{authMessage}</Text>}
            <TouchableOpacity
              style={[styles.accountBtn, styles.authSubmitBtn, { backgroundColor: colors.primary }]}
              onPress={handleAuthSubmit}
              activeOpacity={0.85}
              disabled={authBusy || authLoading}
            >
              {authBusy ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={[styles.accountBtnText, { color: '#FFFFFF' }]}>
                  {authMode === 'signup' ? 'Create account' : 'Sign in'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
      {renderTabBar()}
      {tabContent[activeTab]()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  screenTitle: {
    fontSize: typography.title,
    fontWeight: '700',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
  },
  accountCard: {
    marginHorizontal: 20,
    marginBottom: 8,
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
  },
  accountPanel: {
    width: '100%',
  },
  accountHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  accountCopy: {
    flex: 1,
  },
  accountTitle: {
    fontSize: typography.body,
    fontWeight: '700',
    marginBottom: 4,
  },
  accountBody: {
    fontSize: typography.caption,
    lineHeight: 18,
  },
  accountBtn: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 108,
  },
  accountBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  authModeSwitch: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
  },
  authModeButton: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  authModeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  authInput: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: typography.body,
    marginBottom: 10,
  },
  authError: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
  },
  authMessage: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
  },
  authSubmitBtn: {
    minWidth: 0,
    alignSelf: 'flex-start',
    paddingHorizontal: 18,
  },

  /* Tab Bar */
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: typography.body,
    fontWeight: '500',
  },
  tabTextActive: {
    fontWeight: '700',
  },

  /* Shared scroll */
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionDesc: {
    fontSize: typography.body,
    marginBottom: 16,
    lineHeight: 22,
  },

  /* Thresholds */
  sliderCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sliderLabel: {
    fontSize: typography.body,
    fontWeight: '600',
  },
  sliderRange: {
    fontSize: typography.caption,
  },

  /* Theme Picker */
  sectionLabel: {
    fontSize: typography.subtitle,
    fontWeight: '700',
    marginBottom: 12,
  },
  themePicker: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 16,
    padding: 8,
    gap: 8,
  },
  themeOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  themeIcon: {
    fontSize: 22,
    marginBottom: 6,
  },
  themeLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  themeDesc: {
    fontSize: 10,
    textAlign: 'center',
  },

  /* Customize - Wind unit picker */
  windUnitRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 16,
    padding: 8,
    gap: 6,
  },
  windUnitBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  windUnitText: {
    fontSize: 13,
    fontWeight: '700',
  },

  /* Customize - Section cards */
  sectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  sectionCardIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  sectionCardInfo: {
    flex: 1,
    marginRight: 8,
  },
  sectionCardLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  sectionCardLabel: {
    fontSize: typography.body,
    fontWeight: '700',
  },
  sectionCardDesc: {
    fontSize: typography.caption,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  priorityBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  sectionCardActions: {
    flexDirection: 'row',
    gap: 6,
  },
  orderBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  addBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  layoutHintCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  layoutHintTitle: {
    fontSize: typography.body,
    fontWeight: '700',
    marginBottom: 6,
  },
  layoutHintBody: {
    fontSize: typography.caption,
    lineHeight: 18,
  },
  resetLayoutBtn: {
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
  },
  resetLayoutBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },

  /* Notifications */
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  notifInfo: {
    flex: 1,
    marginRight: 12,
  },
  notifLabel: {
    fontSize: typography.body,
    fontWeight: '600',
    marginBottom: 4,
  },
  notifDesc: {
    fontSize: typography.caption,
    lineHeight: 18,
  },
  notificationHint: {
    fontSize: typography.caption,
    lineHeight: 18,
    marginBottom: 14,
  },
  notificationStatusCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  notificationStatusTitle: {
    fontSize: typography.body,
    fontWeight: '700',
    marginBottom: 4,
  },
  notificationStatusBody: {
    fontSize: typography.caption,
    lineHeight: 18,
  },

  /* About */
  aboutContainer: {
    alignItems: 'center',
  },
  aboutHero: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 24,
    padding: 22,
    marginBottom: 16,
    alignItems: 'center',
  },
  aboutEmoji: {
    fontSize: 64,
    marginBottom: 8,
  },
  aboutAppName: {
    fontSize: typography.title,
    fontWeight: '800',
  },
  aboutVersion: {
    fontSize: typography.body,
    marginTop: 4,
  },
  aboutTagline: {
    fontSize: typography.body,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 18,
    textAlign: 'center',
    lineHeight: 24,
  },
  aboutHighlightRow: {
    width: '100%',
    gap: 10,
  },
  aboutHighlightChip: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  aboutHighlightLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  aboutHighlightValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  aboutCard: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  aboutCardTitle: {
    fontSize: typography.subtitle,
    fontWeight: '700',
    marginBottom: 10,
  },
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  aboutDot: {
    fontSize: typography.body,
    marginRight: 8,
    lineHeight: 22,
  },
  aboutRowText: {
    fontSize: typography.body,
    lineHeight: 22,
    flex: 1,
  },
  aboutBodyText: {
    fontSize: typography.body,
    lineHeight: 22,
  },
});
