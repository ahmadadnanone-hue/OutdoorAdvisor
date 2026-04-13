import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'routeadvisor_settings';

const DEFAULT_SETTINGS = {
  units: 'metric', // 'metric' | 'imperial'
  windUnit: 'kmh', // 'kmh' | 'mph' | 'ms' | 'knots'
  homeSections: [],
  enabledActivities: [],
};

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
          setSettings({ ...DEFAULT_SETTINGS, ...parsed });
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

  // Stubs for legacy settings screen compatibility (cleaned up in Phase 6)
  const moveSection = useCallback(() => {}, []);
  const toggleSection = useCallback(() => {}, []);
  const resetHomeSections = useCallback(() => {}, []);
  const addActivity = useCallback(() => {}, []);
  const removeActivity = useCallback(() => {}, []);

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
