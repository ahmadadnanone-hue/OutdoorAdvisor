import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradient } from '../../design';
import { useTheme } from '../../context/ThemeContext';

/**
 * ScreenGradient — clean slate/blue backdrop with no wallpaper graphics.
 */
export default function ScreenGradient({ children, style }) {
  const { isDark } = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: isDark ? colors.bgTop : gradient.lightScreen[0] }, style]}>
      <LinearGradient
        colors={isDark ? gradient.screen : gradient.lightScreen}
        start={isDark ? gradient.screenStart : gradient.lightScreenStart}
        end={isDark ? gradient.screenEnd : gradient.lightScreenEnd}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
});
