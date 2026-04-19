import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { SettingsProvider } from './src/context/SettingsContext';
import { AuthProvider } from './src/context/AuthContext';

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
import { GlassTabBar } from './src/components/glass';
import Icon, { ICON } from './src/components/Icon';
import { colors as dc } from './src/design';

const Tab = createBottomTabNavigator();

const TABS = [
  { key: 'Home',       label: 'Home',       icon: ICON.home },
  { key: 'Travel',     label: 'Travel',     icon: ICON.travel },
  { key: 'Activities', label: 'Outdoors',   icon: ICON.activities },
  { key: 'Settings',   label: 'Settings',   icon: ICON.settings },
];

function GlassNavBar({ state, navigation }) {
  const insets = useSafeAreaInsets();
  const activeKey = state.routes[state.index].name;

  const items = TABS.map(({ key, label, icon }) => ({
    key,
    label,
    icon: (
      <Icon
        name={icon}
        size={20}
        color={key === activeKey ? dc.accentCyan : dc.textSecondary}
      />
    ),
  }));

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.tabBarShell,
        { paddingBottom: Math.max(insets.bottom - 2, 6) },
      ]}
    >
      <GlassTabBar
        items={items}
        activeKey={activeKey}
        onChange={(key) => navigation.navigate(key)}
      />
    </View>
  );
}

function AppNavigator() {
  const { isDark, colors } = useTheme();

  return (
    <>
      <StatusBar style="light" />
      <NavigationContainer
        theme={{
          dark: isDark,
          colors: {
            primary: colors.primary,
            background: 'transparent',
            card: 'transparent',
            text: colors.text,
            border: 'transparent',
            notification: colors.primary,
          },
          fonts,
        }}
      >
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            sceneStyle: { backgroundColor: 'transparent' },
          }}
          tabBar={(props) => <GlassNavBar {...props} />}
        >
          <Tab.Screen name="Home"       component={HomeScreen} />
          <Tab.Screen name="Travel"     component={TravelScreen} />
          <Tab.Screen name="Activities" component={ActivitiesScreen} />
          <Tab.Screen name="Settings"   component={AlertsScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </>
  );
}

const styles = StyleSheet.create({
  tabBarShell: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
});

export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <ThemeProvider>
          <AppNavigator />
        </ThemeProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}
