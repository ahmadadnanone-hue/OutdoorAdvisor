import React, { createContext, useContext, useState, useEffect } from 'react';
import { Appearance, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors as dc } from '../design';

const STORAGE_KEY = 'outdooradvisor_theme_mode';
const DEFAULT_THEME_MODE = 'dark';

const ThemeContext = createContext();

/**
 * ThemeContext controls the app-level Light / Dark / Auto preference and asks
 * iOS to resolve DynamicColorIOS design tokens against that choice.
 */
export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(DEFAULT_THEME_MODE); // 'auto' | 'dark' | 'light'
  const [systemScheme, setSystemScheme] = useState(() => Appearance.getColorScheme() || 'light');
  const [isReady, setIsReady] = useState(Platform.OS === 'web');

  useEffect(() => {
    let mounted = true;
    const appearanceSubscription = Appearance.addChangeListener(({ colorScheme }) => {
      if (mounted && colorScheme) setSystemScheme(colorScheme);
    });

    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (!mounted) return;
        const savedMode = saved === 'auto' || saved === 'dark' || saved === 'light' ? saved : DEFAULT_THEME_MODE;
        if (Platform.OS !== 'web' && typeof Appearance.setColorScheme === 'function') {
          Appearance.setColorScheme(savedMode === 'auto' ? null : savedMode);
        }
        setMode(savedMode);
        setSystemScheme(Appearance.getColorScheme() || 'light');
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setIsReady(true);
      });

    return () => {
      mounted = false;
      appearanceSubscription.remove();
    };
  }, []);

  const isDark = mode === 'auto' ? systemScheme === 'dark' : mode === 'dark';

  const setThemeMode = async (newMode) => {
    if (Platform.OS !== 'web' && typeof Appearance.setColorScheme === 'function') {
      Appearance.setColorScheme(newMode === 'auto' ? null : newMode);
    }
    setMode(newMode);
    setSystemScheme(Appearance.getColorScheme() || 'light');
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

  return isReady ? (
    <ThemeContext.Provider value={{ isDark, mode, cycleTheme, setThemeMode, toggleTheme: cycleTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  ) : null;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
}

export default ThemeContext;
