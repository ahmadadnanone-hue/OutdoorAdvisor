import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { colors as dc } from '../design';

export default function LoadingScreen() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={dc.accentCyan} />
      <Text style={styles.text}>Loading…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: dc.bgTop,
  },
  text: {
    fontSize: 17,
    color: dc.textSecondary,
    marginTop: 16,
  },
});
