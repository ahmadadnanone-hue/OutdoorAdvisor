import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors as dc } from '../design';

const STORAGE_KEY = 'outdooradvisor_theme_mode';

const ThemeContext = createContext();

/**
 * iOS-only app is always dark. ThemeContext still exists so:
 *   1. AlertsScreen can let users pick Dark / Light / Auto appearance preference
 *      (stored, respected by system).
 *   2. NavigationContainer gets a stable theme object.
 *
 * All screen colors should come from src/design/colors.js (dc.*), NOT from
 * the `colors` object here.
 */
export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  const [mode, setMode] = useState('auto'); // 'auto' | 'dark' | 'light'

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved === 'auto' || saved === 'dark' || saved === 'light') setMode(saved);
      })
      .catch(() => {});
  }, []);

  const isDark = mode === 'auto' ? systemScheme !== 'light' : mode === 'dark';

  const setThemeMode = async (newMode) => {
    setMode(newMode);
    AsyncStorage.setItem(STORAGE_KEY, newMode).catch(() => {});
  };

  const cycleTheme = () => {
    const next = mode === 'auto' ? 'light' : mode === 'light' ? 'dark' : 'auto';
    setThemeMode(next);
  };

  // Provide a minimal colors object so NavigationContainer stays stable.
  // All screens import from src/design directly — do NOT add new keys here.
  const colors = {
    primary: dc.accentCyan,
    text: dc.textPrimary,
    textSecondary: dc.textSecondary,
    background: dc.bgTop,
    card: dc.cardGlass,
    border: dc.cardStrokeSoft,
  };

  return (
    <ThemeContext.Provider value={{ isDark, mode, cycleTheme, setThemeMode, toggleTheme: cycleTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
}

export default ThemeContext;
