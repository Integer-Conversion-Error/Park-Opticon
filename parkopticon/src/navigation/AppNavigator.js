import React from 'react';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme';
import FloatingTabBar, { getFloatingTabBarHeight } from './FloatingTabBar';

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

function MainTabs() {
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const theme = useAppTheme();

  return (
    <Tab.Navigator
      initialRouteName={process.env.EXPO_PUBLIC_AUTH_TEST_MODE === '1' ? 'Account' : 'Map'}
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: theme.colors.background },
        // Reserve the complete control and system inset for screens that place
        // content above the pill, while allowing the map to continue behind it.
        tabBarStyle: {
          position: 'absolute',
          height: getFloatingTabBarHeight(insets.bottom, fontScale),
          paddingBottom: insets.bottom + 8,
        },
      }}
    >
      <Tab.Screen name="Map" component={MapScreen} options={{ headerShown: false, title: 'Map' }} />
      <Tab.Screen name="Account" component={ProfileScreen} options={{ title: 'Account' }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const theme = useAppTheme();
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
    <NavigationContainer theme={{
      ...(theme.dark ? DarkTheme : DefaultTheme),
      colors: {
        ...(theme.dark ? DarkTheme.colors : DefaultTheme.colors),
        background: theme.colors.background,
        border: theme.colors.border.light,
        card: theme.colors.surface,
        primary: theme.colors.primaryDark,
        text: theme.colors.text,
      },
    }}>
      <RootStack.Navigator
        screenOptions={{
          contentStyle: { backgroundColor: theme.colors.background },
          headerStyle: { backgroundColor: theme.colors.background },
          headerTintColor: theme.colors.primaryDark,
          headerTitleStyle: { color: theme.colors.text, fontWeight: '600' },
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
          }}
        />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
