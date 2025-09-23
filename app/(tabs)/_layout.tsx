// In app/(tabs)/_layout.tsx
import { Feather } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import React from 'react';
import { TouchableOpacity } from 'react-native';

// Import our theme hooks
import { useTheme } from '../../context/ThemeContext';
import { useThemeColor } from '../../hooks/use-theme-color';

// The custom button now uses theme hooks to get its colors
const AddExpenseButton = () => {
  const router = useRouter();
  const { theme } = useTheme();

  // Define colors for the button based on the theme
  const buttonBackgroundColor = theme === 'light' ? '#4A90E2' : useThemeColor({}, 'card');
  const iconColor = theme === 'light' ? '#FFFFFF' : useThemeColor({}, 'text');
  const shadowColor = useThemeColor({}, 'text');

  return (
    <TouchableOpacity
      onPress={() => router.push('/add-expense')}
      style={{
        top: -22,
        justifyContent: 'center',
        alignItems: 'center',
        width: 58,
        height: 58,
        borderRadius: 30,
        backgroundColor: buttonBackgroundColor,
        shadowColor: shadowColor,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: theme === 'light' ? 0.25 : 0.4, // Adjust shadow for dark mode
        shadowRadius: 3.84,
        elevation: 5,
      }}>
      <Feather name="plus" size={30} color={iconColor} />
    </TouchableOpacity>
  );
};

export default function TabLayout() {
  // Fetch theme colors inside the component
  const cardColor = useThemeColor({}, 'card');
  const activeTabColor = useThemeColor({}, 'text');
  const inactiveTabColor = useThemeColor({}, 'tabIconDefault');
  const shadowColor = useThemeColor({}, 'text');
  const { theme } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: activeTabColor,
        tabBarInactiveTintColor: inactiveTabColor,
        tabBarStyle: {
          position: 'absolute',
          // MODIFIED: Changed style for a full-width tab bar
          bottom: 0,
          left: 0,
          right: 0,
          elevation: 0,
          backgroundColor: cardColor,
          height: 65, // Slightly increased height for better visual spacing
          borderTopWidth: 0,
          // MODIFIED: Adjusted shadow for a bottom-anchored bar
          shadowColor: shadowColor,
          shadowOffset: { width: 0, height: -3 }, // Shadow now goes upwards
          shadowOpacity: theme === 'light' ? 0.05 : 0, // More subtle shadow
          shadowRadius: 3.84,
        },
        // NEW: Added tabBarItemStyle to lower the icons
        tabBarItemStyle: {
          paddingTop: 5, // This pushes the icons down. Adjust the value as needed.
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Feather name="home" size={26} color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color }) => <Feather name="calendar" size={26} color={color} />,
        }}
      />
      <Tabs.Screen
        name="add-expense"
        options={{
          title: 'Add Expense',
          tabBarButton: () => <AddExpenseButton />,
        }}
        listeners={{
          tabPress: e => {
            e.preventDefault();
          },
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Reports',
          tabBarIcon: ({ color }) => <Feather name="pie-chart" size={26} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <Feather name="user" size={26} color={color} />,
        }}
      />
    </Tabs>
  );
}