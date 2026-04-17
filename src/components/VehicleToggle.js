import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';

export const VEHICLE_OPTIONS = [
  { key: 'car', label: 'Car', emoji: '🚗' },
  { key: 'ev', label: 'EV', emoji: '⚡' },
  { key: 'motorbike', label: 'Motorbike', emoji: '🏍️' },
];

// Pakistan motorways (M-1 to M-9) prohibit motorcycles by law. Used by the
// route planner to warn/penalize motorbike routes that touch a motorway leg.
export const VEHICLES_BANNED_FROM_MOTORWAY = new Set(['motorbike']);

/**
 * VehicleToggle — pill-style single-select toggle row. Keeps the route planner
 * header clutter-free while letting the planner specialise suggestions later
 * (EV charge-stop awareness, bike elevation caution, etc.).
 *
 * Props:
 *   - value: one of VEHICLE_OPTIONS[*].key
 *   - onChange: (key) => void
 */
export default function VehicleToggle({ value, onChange }) {
  const { colors, isDark } = useTheme();

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>Vehicle</Text>
      <View
        style={[
          styles.row,
          { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F3F4F6' },
        ]}
      >
        {VEHICLE_OPTIONS.map((option) => {
          const active = value === option.key;
          return (
            <TouchableOpacity
              key={option.key}
              activeOpacity={0.85}
              onPress={() => onChange(option.key)}
              style={[
                styles.pill,
                active && {
                  backgroundColor: isDark ? colors.primary : '#FFFFFF',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.08,
                  shadowRadius: 3,
                  elevation: 2,
                },
              ]}
            >
              <Text style={styles.emoji}>{option.emoji}</Text>
              <Text
                style={[
                  styles.pillText,
                  {
                    color: active
                      ? (isDark ? '#FFFFFF' : colors.primary)
                      : colors.textSecondary,
                    fontWeight: active ? '800' : '600',
                  },
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 14,
    gap: 4,
  },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 10,
    gap: 6,
  },
  emoji: { fontSize: 15 },
  pillText: { fontSize: 13, letterSpacing: 0.2 },
});
