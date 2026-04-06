import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, StyleSheet, Platform } from 'react-native';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { SettingsProvider } from './src/context/SettingsContext';

const WEB_FONT_STACK =
  'system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"';

const fonts = Platform.select({
  web: {
    regular: { fontFamily: WEB_FONT_STACK, fontWeight: '400' },
    medium: { fontFamily: WEB_FONT_STACK, fontWeight: '500' },
    bold: { fontFamily: WEB_FONT_STACK, fontWeight: '600' },
    heavy: { fontFamily: WEB_FONT_STACK, fontWeight: '700' },
  },
  ios: {
    regular: { fontFamily: 'System', fontWeight: '400' },
    medium: { fontFamily: 'System', fontWeight: '500' },
    bold: { fontFamily: 'System', fontWeight: '600' },
    heavy: { fontFamily: 'System', fontWeight: '700' },
  },
  default: {
    regular: { fontFamily: 'sans-serif', fontWeight: 'normal' },
    medium: { fontFamily: 'sans-serif-medium', fontWeight: 'normal' },
    bold: { fontFamily: 'sans-serif', fontWeight: '600' },
    heavy: { fontFamily: 'sans-serif', fontWeight: '700' },
  },
});

import HomeScreen from './src/screens/HomeScreen';
import TravelScreen from './src/screens/TravelScreen';
import ActivitiesScreen from './src/screens/ActivitiesScreen';
import AlertsScreen from './src/screens/AlertsScreen';

const Tab = createBottomTabNavigator();

const TAB_ICONS = {
  Home: { icon: '🏠', label: 'Home' },
  Travel: { icon: '🛣️', label: 'Travel' },
  Activities: { icon: '🏃', label: 'Activities' },
  Settings: { icon: '⚙️', label: 'Settings' },
};

function TabIcon({ name, focused, color }) {
  const config = TAB_ICONS[name];
  return (
    <View style={styles.tabIconContainer}>
      <Text style={[styles.tabEmoji, focused && styles.tabEmojiActive]}>{config.icon}</Text>
      <Text style={[styles.tabLabel, { color }, focused && styles.tabLabelActive]}>{config.label}</Text>
    </View>
  );
}

function AppNavigator() {
  const { isDark, colors } = useTheme();

  const tabBarShadow = !isDark
    ? {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 8,
      }
    : {};

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <NavigationContainer
        theme={{
          dark: isDark,
          colors: {
            primary: colors.primary,
            background: colors.background,
            card: colors.card,
            text: colors.text,
            border: colors.border,
            notification: colors.primary,
          },
          fonts,
        }}
      >
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarIcon: ({ focused, color }) => (
              <TabIcon name={route.name} focused={focused} color={color} />
            ),
            tabBarShowLabel: false,
            tabBarActiveTintColor: colors.primary,
            tabBarInactiveTintColor: colors.textSecondary,
            tabBarStyle: {
              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF',
              borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              borderTopWidth: 1,
              height: 65,
              paddingBottom: 6,
              paddingTop: 6,
              ...tabBarShadow,
            },
          })}
        >
          <Tab.Screen name="Home" component={HomeScreen} />
          <Tab.Screen name="Travel" component={TravelScreen} />
          <Tab.Screen name="Activities" component={ActivitiesScreen} />
          <Tab.Screen name="Settings" component={AlertsScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <ThemeProvider>
        <AppNavigator />
      </ThemeProvider>
    </SettingsProvider>
  );
}

const styles = StyleSheet.create({
  tabIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabEmoji: {
    fontSize: 24,
  },
  tabEmojiActive: {
    fontSize: 26,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 3,
  },
  tabLabelActive: {
    fontWeight: '600',
  },
});
