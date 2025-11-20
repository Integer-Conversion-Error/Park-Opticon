import React from 'react';
import { Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { theme } from '../theme';

// Import screens
import MapScreen from '../screens/MapScreen';
import AlertsScreen from '../screens/AlertsScreen';
import TicketsScreen from '../screens/TicketsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import MyParkingScreen from '../screens/MyParkingScreen';
import ReportParkingScreen from '../screens/ReportParkingScreen';
import ReportEnforcementScreen from '../screens/ReportEnforcementScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Tab icons (using emoji for now, can replace with icons later)
const TabIcon = ({ focused, emoji }) => (
  <Text style={{ fontSize: 24, opacity: focused ? 1 : 0.5 }}>
    {emoji}
  </Text>
);

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: {
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
        },
        headerStyle: {
          backgroundColor: theme.colors.primary,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTintColor: theme.colors.white,
        headerTitleStyle: {
          fontWeight: '600',
          fontSize: 18,
        },
      }}
    >
      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{
          tabBarLabel: 'Map',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} emoji="🗺️" />,
          headerTitle: 'Parkopticon',
        }}
      />
      <Tab.Screen
        name="Alerts"
        component={AlertsScreen}
        options={{
          tabBarLabel: 'Alerts',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} emoji="🚨" />,
          headerTitle: 'Enforcement Alerts',
        }}
      />
      <Tab.Screen
        name="MyParking"
        component={MyParkingScreen}
        options={{
          tabBarLabel: 'My Parking',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} emoji="🅿️" />,
          headerTitle: 'My Parking',
        }}
      />
      <Tab.Screen
        name="Tickets"
        component={TicketsScreen}
        options={{
          tabBarLabel: 'Tickets',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} emoji="🎫" />,
          headerTitle: 'My Tickets',
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} emoji="👤" />,
          headerTitle: 'Profile',
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <MainTabs />
    </NavigationContainer>
  );
}
