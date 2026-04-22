import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Platform, StyleSheet, AppState } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { SettingsProvider } from './src/context/SettingsContext';
import { AuthProvider } from './src/context/AuthContext';
import { LocationProvider } from './src/context/LocationContext';

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
import FABMenu from './src/components/FABMenu';
import { colors as dc } from './src/design';
import { ensureLocalNotificationPermission } from './src/utils/alertNotifications';
import { getTodayHealthSnapshot, initializeHealthPermissions } from './src/hooks/useHealthData';
import { registerOutdoorAdvisorBackgroundTask } from './src/services/backgroundTask';
import { runSmartAdvisorCheck } from './src/services/smartAdvisor';

const Tab = createBottomTabNavigator();

const TABS = [
  { key: 'Home',       label: 'Home',       icon: ICON.home },
  { key: 'Travel',     label: 'Travel',     icon: ICON.travel },
  { key: 'Activities', label: 'Outdoors',   icon: ICON.activities },
  { key: 'Settings',   label: 'Settings',   icon: ICON.settings },
];

function GlassNavBar({ state, navigation, onRouteChange }) {
  const insets = useSafeAreaInsets();
  const activeKey = state.routes[state.index].name;

  React.useEffect(() => {
    onRouteChange?.(activeKey);
  }, [activeKey, onRouteChange]);

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
  const [activeRouteName, setActiveRouteName] = useState('Home');

  useEffect(() => {
    let mounted = true;

    const boot = async () => {
      await ensureLocalNotificationPermission({ prompt: true }).catch(() => {});
      await initializeHealthPermissions({ prompt: Platform.OS === 'ios' }).catch(() => {});
      await getTodayHealthSnapshot({ force: true, prompt: false }).catch(() => {});
      await registerOutdoorAdvisorBackgroundTask().catch(() => {});
      await runSmartAdvisorCheck({ reason: 'app-start', promptForHealth: false }).catch(() => {});
    };

    boot();

    const subscription = AppState.addEventListener('change', (state) => {
      if (!mounted || state !== 'active') return;
      runSmartAdvisorCheck({ reason: 'foreground', promptForHealth: false }).catch(() => {});
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

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
          tabBar={(props) => <GlassNavBar {...props} onRouteChange={setActiveRouteName} />}
        >
          <Tab.Screen name="Home"       component={HomeScreen} />
          <Tab.Screen name="Travel"     component={TravelScreen} />
          <Tab.Screen name="Activities" component={ActivitiesScreen} />
          <Tab.Screen name="Settings"   component={AlertsScreen} />
        </Tab.Navigator>

        {/* Global FAB — rendered inside NavigationContainer for useNavigation access */}
        <FABMenu currentRouteName={activeRouteName} />
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
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      const content = viewport.getAttribute('content') || '';
      if (!content.includes('viewport-fit=cover')) {
        viewport.setAttribute('content', `${content}, viewport-fit=cover`);
      }
    }

    let themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (!themeColorMeta) {
      themeColorMeta = document.createElement('meta');
      themeColorMeta.setAttribute('name', 'theme-color');
      document.head.appendChild(themeColorMeta);
    }
    themeColorMeta.setAttribute('content', dc.bgTop);

    const root = document.getElementById('root');

    document.documentElement.style.backgroundColor = dc.bgTop;
    document.documentElement.style.height = '100dvh';
    document.documentElement.style.minHeight = '100dvh';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.backgroundColor = dc.bgTop;
    document.body.style.margin = '0';
    document.body.style.height = '100dvh';
    document.body.style.minHeight = '100dvh';
    document.body.style.overflow = 'hidden';
    document.body.style.webkitOverflowScrolling = 'touch';

    if (root) {
      root.style.height = '100dvh';
      root.style.minHeight = '100dvh';
      root.style.width = '100%';
    }

    const applyFillAvailable = () => {
      document.documentElement.style.minHeight = '-webkit-fill-available';
      document.body.style.minHeight = '-webkit-fill-available';
      if (root) root.style.minHeight = '-webkit-fill-available';
    };

    // iOS Safari/Chrome sometimes honor -webkit-fill-available better than 100vh.
    applyFillAvailable();
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <LocationProvider>
          <SettingsProvider>
            <ThemeProvider>
              <AppNavigator />
            </ThemeProvider>
          </SettingsProvider>
        </LocationProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
