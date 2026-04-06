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
import typography from '../theme/typography';
import {
  ensureWebPush,
  hasPushSubscription,
  isWebPushSupported,
  syncWebPushPreferences,
} from '../utils/webPush';
import {
  DEFAULT_NOTIFICATIONS,
  DEFAULT_THRESHOLDS,
  loadMockAccount,
  loadStoredNotifications,
  loadStoredThresholds,
  saveMockAccount,
  saveStoredNotifications,
  saveStoredThresholds,
} from '../utils/alertPreferences';
import { ensureLocalNotificationPermission } from '../utils/alertNotifications';

const TABS = ['Thresholds', 'Notifications', 'Customize', 'About'];

const SECTION_META = {
  decision: { label: 'Outdoor Decision', icon: '🧭', desc: 'Plain-language go / go with care / limit exposure answer' },
  travel: { label: 'Travel Quick Checks', icon: '🛣️', desc: 'Fast access to Murree and M2 route conditions' },
  aqi: { label: 'Live Conditions Hero', icon: '🌤️', desc: 'Weather-led hero card with location, motion, and AQI context' },
  wind: { label: 'Wind', icon: '💨', desc: 'Wind speed, gusts & direction' },
  details: { label: 'Current Details', icon: '📊', desc: 'Feels like, PM2.5, temp, and pollen' },
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
  const [activeTab, setActiveTab] = useState(0);

  // Thresholds state
  const [thresholds, setThresholds] = useState(DEFAULT_THRESHOLDS);

  // Notifications state
  const [notifications, setNotifications] = useState(DEFAULT_NOTIFICATIONS);
  const [pushSupported, setPushSupported] = useState(false);
  const [mockAccount, setMockAccount] = useState(null);
  const [accountBusy, setAccountBusy] = useState(false);

  // Load persisted data on mount
  useEffect(() => {
    (async () => {
      setThresholds(await loadStoredThresholds());
      setNotifications(await loadStoredNotifications());
      setMockAccount(await loadMockAccount());
    })();
  }, []);

  const handleMockSignIn = useCallback(async () => {
    setAccountBusy(true);
    try {
      if (mockAccount) {
        await saveMockAccount(null);
        setMockAccount(null);
        return;
      }

      const account = {
        name: 'Guest Explorer',
        email: 'guest@outdooradvisor.app',
        provider: 'Mock',
      };
      await saveMockAccount(account);
      setMockAccount(account);
    } finally {
      setAccountBusy(false);
    }
  }, [mockAccount]);

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

        <Text style={[styles.sectionLabel, { color: colors.text, marginTop: 24 }]}>Notifications</Text>
        <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
          These preferences control the alerts OutdoorAdvisor should watch for. On supported browsers, notification permission is handled automatically when you turn alerts on.
        </Text>
        {Platform.OS === 'web' && (
          <Text style={[styles.notificationHint, { color: colors.textSecondary }]}>
            {pushSupported
              ? 'Browser alerts will be requested the first time you turn on a notification that needs them.'
              : 'This browser cannot receive the current web notification setup, but your alert preferences are still saved.'}
          </Text>
        )}

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
            Lead with decision-making first, then travel and AQI, followed by forecast and supporting details.
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
    const sdkVersion = '55';

    return (
      <ScrollView contentContainerStyle={[styles.scrollContent, styles.aboutContainer]} showsVerticalScrollIndicator={false}>
        <Text style={styles.aboutEmoji}>🌬️</Text>
        <Text style={[styles.aboutAppName, { color: colors.text }]}>OutdoorAdvisor</Text>
        <Text style={[styles.aboutVersion, { color: colors.textSecondary }]}>Version 1.0.0</Text>
        <Text style={[styles.aboutTagline, { color: colors.accent }]}>
          Your smart guide to outdoor safety — real-time AQI, weather & travel conditions across Pakistan.
        </Text>

        <View style={[styles.aboutCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.aboutCardTitle, { color: colors.primary }]}>What It Covers</Text>
          <View style={styles.aboutRow}>
            <Text style={[styles.aboutDot, { color: colors.accent }]}>•</Text>
            <Text style={[styles.aboutRowText, { color: colors.text }]}>AQI, weather, pollen, and route conditions in one place</Text>
          </View>
          <View style={styles.aboutRow}>
            <Text style={[styles.aboutDot, { color: colors.accent }]}>•</Text>
            <Text style={[styles.aboutRowText, { color: colors.text }]}>Pakistan-focused guidance for daily outdoor plans and travel</Text>
          </View>
          <View style={styles.aboutRow}>
            <Text style={[styles.aboutDot, { color: colors.accent }]}>•</Text>
            <Text style={[styles.aboutRowText, { color: colors.text }]}>Clickable insights that explain what the conditions mean</Text>
          </View>
        </View>

        <View style={[styles.aboutCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.aboutCardTitle, { color: colors.primary }]}>Live Data & Stack</Text>
          <View style={styles.aboutRow}>
            <Text style={[styles.aboutDot, { color: colors.accent }]}>•</Text>
            <Text style={[styles.aboutRowText, { color: colors.text }]}>Google APIs power AQI, weather, pollen, maps, and location search</Text>
          </View>
          <View style={styles.aboutRow}>
            <Text style={[styles.aboutDot, { color: colors.accent }]}>•</Text>
            <Text style={[styles.aboutRowText, { color: colors.text }]}>NHMP and PMD advisories are surfaced through Vercel serverless routes</Text>
          </View>
          <View style={styles.aboutRow}>
            <Text style={[styles.aboutDot, { color: colors.accent }]}>•</Text>
            <Text style={[styles.aboutRowText, { color: colors.text }]}>Expo SDK {sdkVersion} with web push support on compatible browsers</Text>
          </View>
        </View>

        <View style={[styles.aboutCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.aboutCardTitle, { color: colors.primary }]}>Developer</Text>
          <Text style={[styles.aboutBodyText, { color: colors.text }]}>
            Built with ❤️ in Pakistan
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
        <View style={styles.accountCopy}>
          <Text style={[styles.accountTitle, { color: colors.text }]}>
            {mockAccount ? 'Mock account connected' : 'Mock sign in'}
          </Text>
          <Text style={[styles.accountBody, { color: colors.textSecondary }]}>
            {mockAccount
              ? `${mockAccount.email} is currently linked to this device for saved preferences and future account setup.`
              : 'Use a temporary profile for now. We can wire real authentication later without changing the app flow.'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.accountBtn, { backgroundColor: mockAccount ? '#EF4444' + '18' : colors.primary + '16' }]}
          onPress={handleMockSignIn}
          activeOpacity={0.8}
          disabled={accountBusy}
        >
          {accountBusy ? (
            <ActivityIndicator size="small" color={mockAccount ? '#EF4444' : colors.primary} />
          ) : (
            <Text style={[styles.accountBtnText, { color: mockAccount ? '#EF4444' : colors.primary }]}>
              {mockAccount ? 'Sign out' : 'Mock sign in'}
            </Text>
          )}
        </TouchableOpacity>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
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

  /* About */
  aboutContainer: {
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
    fontSize: typography.subtitle,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 24,
    textAlign: 'center',
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
