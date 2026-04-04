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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import typography from '../theme/typography';

const TABS = ['Thresholds', 'Notifications', 'About'];

const THRESHOLDS_KEY = 'outdooradvisor_thresholds';
const NOTIFICATIONS_KEY = 'outdooradvisor_notifications';

const DEFAULT_THRESHOLDS = {
  aqiAlert: 150,
  pm25Alert: 75,
  heatAlert: 42,
  coldAlert: 5,
};

const DEFAULT_NOTIFICATIONS = {
  dailySummary: true,
  smogAlerts: true,
  rainAlerts: false,
  fogWarnings: true,
};

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
  const [activeTab, setActiveTab] = useState(0);

  // Thresholds state
  const [thresholds, setThresholds] = useState(DEFAULT_THRESHOLDS);

  // Notifications state
  const [notifications, setNotifications] = useState(DEFAULT_NOTIFICATIONS);

  // Load persisted data on mount
  useEffect(() => {
    (async () => {
      try {
        const savedT = await AsyncStorage.getItem(THRESHOLDS_KEY);
        if (savedT) setThresholds(JSON.parse(savedT));
      } catch (_) {}
      try {
        const savedN = await AsyncStorage.getItem(NOTIFICATIONS_KEY);
        if (savedN) setNotifications(JSON.parse(savedN));
      } catch (_) {}
    })();
  }, []);

  // Persist thresholds
  const updateThreshold = useCallback(
    (key, value) => {
      const updated = { ...thresholds, [key]: value };
      setThresholds(updated);
      AsyncStorage.setItem(THRESHOLDS_KEY, JSON.stringify(updated)).catch(() => {});
    },
    [thresholds]
  );

  // Persist notifications
  const updateNotification = useCallback(
    (key, value) => {
      const updated = { ...notifications, [key]: value };
      setNotifications(updated);
      AsyncStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated)).catch(() => {});
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
      { key: 'dailySummary', label: 'Daily AQI Summary', desc: 'Receive a morning summary of air quality in your city.' },
      { key: 'smogAlerts', label: 'Smog Season Alerts', desc: 'Get notified when smog season conditions are detected.' },
      { key: 'rainAlerts', label: 'Rain Alerts', desc: 'Be alerted when rain is expected in your area.' },
      { key: 'fogWarnings', label: 'Motorway Fog Warnings', desc: 'Warnings for dangerous fog conditions on motorways.' },
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
          Choose which notifications you want to receive. Changes are saved automatically.
        </Text>

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

        {/* Data Sources */}
        <View style={[styles.aboutCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.aboutCardTitle, { color: colors.primary }]}>Data Sources</Text>
          <View style={styles.aboutRow}>
            <Text style={[styles.aboutDot, { color: colors.accent }]}>•</Text>
            <Text style={[styles.aboutRowText, { color: colors.text }]}>WAQI API (waqi.info)</Text>
          </View>
          <View style={styles.aboutRow}>
            <Text style={[styles.aboutDot, { color: colors.accent }]}>•</Text>
            <Text style={[styles.aboutRowText, { color: colors.text }]}>Open-Meteo API (open-meteo.com)</Text>
          </View>
        </View>

        {/* Developer */}
        <View style={[styles.aboutCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.aboutCardTitle, { color: colors.primary }]}>Developer</Text>
          <Text style={[styles.aboutBodyText, { color: colors.text }]}>
            Built with ❤️ in Pakistan
          </Text>
        </View>

        {/* Tech */}
        <View style={[styles.aboutCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.aboutCardTitle, { color: colors.primary }]}>Technology</Text>
          <View style={styles.aboutRow}>
            <Text style={[styles.aboutDot, { color: colors.accent }]}>•</Text>
            <Text style={[styles.aboutRowText, { color: colors.text }]}>React Native (Expo)</Text>
          </View>
          <View style={styles.aboutRow}>
            <Text style={[styles.aboutDot, { color: colors.accent }]}>•</Text>
            <Text style={[styles.aboutRowText, { color: colors.text }]}>Expo SDK {sdkVersion}</Text>
          </View>
        </View>
      </ScrollView>
    );
  };

  /* ---------- Render ---------- */
  const tabContent = [renderThresholds, renderNotifications, renderAbout];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.screenTitle, { color: colors.text }]}>Settings & Alerts</Text>
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
    paddingBottom: 8,
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
