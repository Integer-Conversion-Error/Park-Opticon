import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../theme';

import MapScreen from '../screens/MapScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ReportEnforcementScreen from '../screens/ReportEnforcementScreen';
import AuthScreen from '../screens/AuthScreen';
import { apiConfigured, setApiGuestMode } from '../services/api';
import { clearTokens, getAccessToken } from '../services/secureStorage';
import { subscribeAuthState } from '../services/authEvents';
import { clearGuestMode, getGuestMode, setGuestMode as persistGuestMode } from '../services/guestMode';

const RootStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const tabIcons = {
  Map: ['map', 'map-outline'],
  Account: ['person-circle', 'person-circle-outline'],
};

function MainTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      initialRouteName={process.env.EXPO_PUBLIC_AUTH_TEST_MODE === '1' ? 'Account' : 'Map'}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarLabelStyle: { fontSize: 9, fontWeight: '700', marginBottom: 1 },
        // Android edge-to-edge can place the system navigation bar over the
        // app. Include the live safe-area inset in both the bar's height and
        // bottom padding so the tab controls always stay above it.
        tabBarStyle: {
          backgroundColor: theme.colors.white,
          borderTopColor: theme.colors.border.light,
          borderTopWidth: 1,
          height: 68 + insets.bottom,
          paddingBottom: 7 + insets.bottom,
          paddingTop: 6,
        },
        tabBarIcon: ({ focused, color, size }) => {
          const [activeIcon, inactiveIcon] = tabIcons[route.name] || ['ellipse', 'ellipse-outline'];
          return <Ionicons name={focused ? activeIcon : inactiveIcon} color={color} size={Math.min(size, 21)} />;
        },
      })}
    >
      <Tab.Screen name="Map" component={MapScreen} options={{ headerShown: false, title: 'Map' }} />
      <Tab.Screen name="Account" component={ProfileScreen} options={{ title: 'Account' }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const [authChecked, setAuthChecked] = React.useState(!apiConfigured);
  // A missing backend is a configuration error, not an authenticated session.
  const [authenticated, setAuthenticated] = React.useState(false);

  React.useEffect(() => {
    if (!apiConfigured) return undefined;
    let mounted = true;
    Promise.all([getAccessToken(), getGuestMode()]).then(([token, storedGuestMode]) => {
      if (storedGuestMode) {
        setApiGuestMode(true);
        if (mounted) {
          setAuthenticated(true);
          setAuthChecked(true);
        }
        return null;
      }
      if (!token) {
        if (mounted) setAuthChecked(true);
        return null;
      }
      return import('../services/api').then(({ api }) => api.profile()).then(() => {
        if (mounted) {
          setAuthenticated(true);
          setAuthChecked(true);
        }
      }).catch(async () => {
        await clearTokens();
        if (mounted) {
          setAuthenticated(false);
          setAuthChecked(true);
        }
      });
    });
    return () => { mounted = false; };
  }, []);

  React.useEffect(() => subscribeAuthState((nextAuthenticated) => {
    setAuthenticated(nextAuthenticated);
    if (!nextAuthenticated) {
      setApiGuestMode(false);
      clearGuestMode();
    }
  }), []);

  if (!authChecked) return null;
  if (!authenticated) {
    return (
      <AuthScreen
        onAuthenticated={() => { setApiGuestMode(false); setAuthenticated(true); }}
        onGuest={async () => {
          await persistGuestMode();
          setApiGuestMode(true);
          setAuthenticated(true);
        }}
      />
    );
  }

  return (
    <NavigationContainer>
      <RootStack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.primary },
          headerTintColor: theme.colors.white,
          headerTitleStyle: { fontWeight: '700' },
        }}
      >
        <RootStack.Screen
          name="MainTabs"
          component={MainTabs}
          options={{ headerShown: false }}
        />
        <RootStack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ headerBackTitle: '', headerShadowVisible: false, title: 'Settings' }}
        />
        <RootStack.Screen
          name="ReportEnforcement"
          component={ReportEnforcementScreen}
          options={{
            animation: 'fade',
            contentStyle: { backgroundColor: 'transparent' },
            headerShown: false,
            presentation: 'transparentModal',
            statusBarColor: 'transparent',
            statusBarTranslucent: true,
          }}
        />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
