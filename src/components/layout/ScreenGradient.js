import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradient } from '../../design';

/**
 * ScreenGradient — clean slate/blue backdrop with no wallpaper graphics.
 */
export default function ScreenGradient({ children, style }) {
  return (
    <View style={[styles.root, style]}>
      <LinearGradient
        colors={gradient.screen}
        start={gradient.screenStart}
        end={gradient.screenEnd}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgTop },
  content: { flex: 1 },
});
