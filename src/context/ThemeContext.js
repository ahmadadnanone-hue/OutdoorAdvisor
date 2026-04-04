import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightTheme, darkTheme, common } from '../theme/colors';

const STORAGE_KEY = 'outdooradvisor_theme_mode';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  const [mode, setMode] = useState('auto'); // 'auto' | 'dark' | 'light'

  useEffect(() => {
    const loadMode = async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved === 'auto' || saved === 'dark' || saved === 'light') {
          setMode(saved);
        }
      } catch (e) {
        // Fall back to auto
      }
    };
    loadMode();
  }, []);

  const isDark =
    mode === 'auto' ? systemScheme === 'dark' : mode === 'dark';

  const cycleTheme = async () => {
    const next = mode === 'auto' ? 'light' : mode === 'light' ? 'dark' : 'auto';
    setMode(next);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, next);
    } catch (e) {
      // Silently fail
    }
  };

  const setThemeMode = async (newMode) => {
    setMode(newMode);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, newMode);
    } catch (e) {
      // Silently fail
    }
  };

  const colors = {
    ...(isDark ? darkTheme : lightTheme),
    ...common,
  };

  return (
    <ThemeContext.Provider value={{ isDark, mode, cycleTheme, setThemeMode, toggleTheme: cycleTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export default ThemeContext;
