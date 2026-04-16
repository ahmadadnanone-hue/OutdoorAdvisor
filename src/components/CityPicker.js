import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';

/**
 * CityPicker — a tappable field that opens a searchable modal with a list of
 * cities. Works consistently on iOS, Android, and Web (no Google SDK needed).
 *
 * Props:
 *   - label: string              e.g. 'From' or 'To'
 *   - value: string              currently-selected city name
 *   - options: Array<{ name }>   list of supported cities
 *   - onChange: (name) => void
 *   - accentColor?: string       optional override for the chip tint
 *   - placeholder?: string       optional placeholder when no value
 */
export default function CityPicker({
  label,
  value,
  options,
  onChange,
  accentColor,
  placeholder = 'Select a city',
}) {
  const { colors, isDark } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const tint = accentColor || colors.primary;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((item) => item.name.toLowerCase().includes(q));
  }, [options, query]);

  const handleSelect = (name) => {
    onChange(name);
    setOpen(false);
    setQuery('');
  };

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setOpen(true)}
        style={[
          styles.field,
          {
            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
            borderColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
        <View style={styles.fieldValueRow}>
          <Text
            style={[styles.fieldValue, { color: value ? colors.text : colors.textSecondary }]}
            numberOfLines={1}
          >
            {value || placeholder}
          </Text>
          <Text style={[styles.chevron, { color: tint }]}>▾</Text>
        </View>
      </TouchableOpacity>

      <Modal
        visible={open}
        animationType="slide"
        transparent
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.backdrop}>
          <View
            style={[
              styles.sheet,
              { backgroundColor: colors.background, borderColor: colors.border },
            ]}
          >
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>
                {label === 'From' ? 'Start from' : label === 'To' ? 'Arrive at' : label}
              </Text>
              <TouchableOpacity onPress={() => setOpen(false)} activeOpacity={0.7}>
                <Text style={[styles.sheetClose, { color: tint }]}>Close</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search cities"
              placeholderTextColor={colors.textSecondary}
              autoCorrect={false}
              autoCapitalize="none"
              style={[
                styles.search,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F3F4F6',
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
            />

            <FlatList
              data={filtered}
              keyExtractor={(item) => item.name}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    No cities matched "{query}"
                  </Text>
                </View>
              }
              renderItem={({ item }) => {
                const selected = item.name === value;
                return (
                  <TouchableOpacity
                    onPress={() => handleSelect(item.name)}
                    activeOpacity={0.8}
                    style={[
                      styles.row,
                      {
                        borderBottomColor: colors.border,
                        backgroundColor: selected ? tint + '14' : 'transparent',
                      },
                    ]}
                  >
                    <Text style={styles.rowPin}>📍</Text>
                    <Text
                      style={[
                        styles.rowText,
                        { color: selected ? tint : colors.text, fontWeight: selected ? '700' : '500' },
                      ]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    {selected && <Text style={[styles.rowCheck, { color: tint }]}>✓</Text>}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 62,
    justifyContent: 'center',
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  fieldValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  fieldValue: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  chevron: {
    fontSize: 14,
    fontWeight: '700',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    maxHeight: '82%',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 24,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  sheetClose: {
    fontSize: 15,
    fontWeight: '700',
  },
  search: {
    height: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
    borderRadius: 8,
  },
  rowPin: { fontSize: 16 },
  rowText: { flex: 1, fontSize: 15 },
  rowCheck: { fontSize: 16, fontWeight: '800' },
  emptyWrap: { paddingVertical: 32, alignItems: 'center' },
  emptyText: { fontSize: 14 },
});
