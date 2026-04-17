import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_ENABLED_ACTIVITY_IDS } from '../data/activities';

const STORAGE_KEY = 'outdooradvisor_settings';

const LEGACY_HOME_SECTIONS = [
  'decision',
  'travel',
  'aqi',
  'forecast',
  'activities',
  'details',
  'wind',
];

const PREVIOUS_DEFAULT_HOME_SECTIONS = [
  'aqi',
  'decision',
  'activities',
  'travel',
  'forecast',
  'details',
  'wind',
];

const DEFAULT_HOME_SECTIONS = [
  'aqi',
  'decision',
  'activities',
  'travel',
];

const DEFAULT_SETTINGS = {
  units: 'metric', // 'metric' | 'imperial'
  windUnit: 'kmh', // 'kmh' | 'mph' | 'ms' | 'knots'
  homeSections: DEFAULT_HOME_SECTIONS,
  enabledActivities: DEFAULT_ENABLED_ACTIVITY_IDS,
  // Route Planner niche vehicle flags (off by default so the toggle stays tidy).
  showScooterVehicle: false,
};

function normalizeEnabledActivities(enabledActivities) {
  const incoming = Array.isArray(enabledActivities) ? enabledActivities.filter(Boolean) : [];
  if (!incoming.length) {
    return DEFAULT_ENABLED_ACTIVITY_IDS;
  }

  const next = [...incoming];
  if (!next.includes('gym')) {
    next.push('gym');
  }
  return next;
}

function normalizeHomeSections(homeSections) {
  const incoming = Array.isArray(homeSections) ? homeSections : [];
  if (
    incoming.length === LEGACY_HOME_SECTIONS.length &&
    incoming.every((key, index) => key === LEGACY_HOME_SECTIONS[index])
  ) {
    return DEFAULT_HOME_SECTIONS;
  }
  if (
    incoming.length === PREVIOUS_DEFAULT_HOME_SECTIONS.length &&
    incoming.every((key, index) => key === PREVIOUS_DEFAULT_HOME_SECTIONS[index])
  ) {
    return DEFAULT_HOME_SECTIONS;
  }
  const known = new Set([...DEFAULT_HOME_SECTIONS, 'forecast', 'details', 'wind', 'pollen']);
  const cleaned = incoming.filter((key) => known.has(key));
  const missingDefaults = DEFAULT_HOME_SECTIONS.filter((key) => !cleaned.includes(key));
  return [...cleaned, ...missingDefaults];
}

const SettingsContext = createContext();

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          setSettings({
            ...DEFAULT_SETTINGS,
            ...parsed,
            homeSections: normalizeHomeSections(parsed.homeSections),
            enabledActivities: normalizeEnabledActivities(parsed.enabledActivities),
          });
        }
      } catch {}
      setLoaded(true);
    })();
  }, []);

  const updateSettings = useCallback(async (patch) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const setUnits = useCallback((u) => updateSettings({ units: u }), [updateSettings]);
  const setWindUnit = useCallback((w) => updateSettings({ windUnit: w }), [updateSettings]);

  const moveSection = useCallback((from, to) => {
    setSettings((prev) => {
      const arr = [...prev.homeSections];
      const [item] = arr.splice(from, 1);
      arr.splice(to, 0, item);
      const next = { ...prev, homeSections: arr };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const resetHomeSections = useCallback(() => {
    updateSettings({ homeSections: DEFAULT_HOME_SECTIONS });
  }, [updateSettings]);

  const addActivity = useCallback((id) => {
    setSettings((prev) => {
      if (prev.enabledActivities.includes(id)) return prev;
      const next = { ...prev, enabledActivities: [...prev.enabledActivities, id] };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const removeActivity = useCallback((id) => {
    setSettings((prev) => {
      const next = { ...prev, enabledActivities: prev.enabledActivities.filter((x) => x !== id) };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const toggleSection = useCallback((key) => {
    setSettings((prev) => {
      let arr = [...prev.homeSections];
      if (arr.includes(key)) {
        arr = arr.filter((k) => k !== key);
      } else {
        arr.push(key);
      }
      const next = { ...prev, homeSections: arr };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  // Unit conversion helpers
  const convertTemp = useCallback((celsius) => {
    if (celsius == null) return null;
    return settings.units === 'imperial' ? (celsius * 9) / 5 + 32 : celsius;
  }, [settings.units]);

  const formatTemp = useCallback((celsius) => {
    if (celsius == null) return '--';
    const val = Math.round(convertTemp(celsius));
    return `${val}°${settings.units === 'imperial' ? 'F' : 'C'}`;
  }, [convertTemp, settings.units]);

  const formatTempShort = useCallback((celsius) => {
    if (celsius == null) return '--';
    return `${Math.round(convertTemp(celsius))}°`;
  }, [convertTemp]);

  const convertWind = useCallback((kmh) => {
    if (kmh == null) return null;
    switch (settings.windUnit) {
      case 'mph': return kmh * 0.621371;
      case 'ms': return kmh / 3.6;
      case 'knots': return kmh * 0.539957;
      default: return kmh;
    }
  }, [settings.windUnit]);

  const formatWind = useCallback((kmh) => {
    if (kmh == null) return '--';
    const val = Math.round(convertWind(kmh));
    const labels = { kmh: 'km/h', mph: 'mph', ms: 'm/s', knots: 'kt' };
    return `${val} ${labels[settings.windUnit]}`;
  }, [convertWind, settings.windUnit]);

  const windUnitLabel = { kmh: 'km/h', mph: 'mph', ms: 'm/s', knots: 'kt' }[settings.windUnit];

  const convertPrecip = useCallback((mm) => {
    if (mm == null) return null;
    return settings.units === 'imperial' ? mm / 25.4 : mm;
  }, [settings.units]);

  const formatPrecip = useCallback((mm) => {
    if (mm == null) return '--';
    const val = convertPrecip(mm);
    return settings.units === 'imperial' ? `${val.toFixed(2)} in` : `${val.toFixed(1)} mm`;
  }, [convertPrecip, settings.units]);

  return (
    <SettingsContext.Provider value={{
      ...settings,
      loaded,
      updateSettings,
      setUnits,
      setWindUnit,
      moveSection,
      toggleSection,
      resetHomeSections,
      addActivity,
      removeActivity,
      convertTemp,
      formatTemp,
      formatTempShort,
      convertWind,
      formatWind,
      windUnitLabel,
      convertPrecip,
      formatPrecip,
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within SettingsProvider');
  return context;
}

export default SettingsContext;
