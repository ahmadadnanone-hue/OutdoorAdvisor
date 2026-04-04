import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';

const MODE_ICONS = {
  auto: '🔄',
  light: '☀️',
  dark: '🌙',
};

const MODE_LABELS = {
  auto: 'Auto',
  light: 'Light',
  dark: 'Dark',
};

export default function ThemeToggle() {
  const { isDark, mode, cycleTheme, colors } = useTheme();

  return (
    <TouchableOpacity
      onPress={cycleTheme}
      activeOpacity={0.7}
      style={[
        styles.pill,
        {
          backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
        },
      ]}
    >
      <Text style={styles.icon}>{MODE_ICONS[mode]}</Text>
      <Text style={[styles.label, { color: colors.textSecondary }]}>
        {MODE_LABELS[mode]}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    height: 34,
    borderRadius: 17,
    gap: 4,
  },
  icon: {
    fontSize: 14,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
  },
});
