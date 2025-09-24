// In app/(tabs)/_layout.tsx
import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React, { useState } from 'react';
import { TouchableOpacity } from 'react-native';
import { AddTransactionModal } from '../../components/AddTransactionModal';
import { useTheme } from '../../context/ThemeContext';
import { useThemeColor } from '../../hooks/use-theme-color';

const AddTransactionButton = ({ onPress }: { onPress: () => void }) => {
  const { theme } = useTheme();
  const buttonBackgroundColor = theme === 'light' ? '#4A90E2' : useThemeColor({}, 'card');
  const iconColor = theme === 'light' ? '#FFFFFF' : useThemeColor({}, 'text');
  const shadowColor = useThemeColor({}, 'text');

  return (
    <TouchableOpacity
      onPress={onPress}
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
        shadowOpacity: theme === 'light' ? 0.25 : 0.4,
        shadowRadius: 3.84,
        elevation: 5,
      }}>
      <Feather name="plus" size={30} color={iconColor} />
    </TouchableOpacity>
  );
};

export default function TabLayout() {
  const { theme } = useTheme();
  const cardColor = useThemeColor({}, 'card');
  const activeTabColor = useThemeColor({}, 'text');
  const inactiveTabColor = useThemeColor({}, 'tabIconDefault');
  const shadowColor = useThemeColor({}, 'text');
  const [isModalVisible, setModalVisible] = useState(false);

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarActiveTintColor: activeTabColor,
          tabBarInactiveTintColor: inactiveTabColor,
          tabBarStyle: {
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            elevation: 0,
            backgroundColor: cardColor,
            height: 70,
            borderTopWidth: 0,
            shadowColor: shadowColor,
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: theme === 'light' ? 0.1 : 0,
            shadowRadius: 3.84,
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
          name="add-transaction"
          options={{
            title: 'Add',
            tabBarButton: () => <AddTransactionButton onPress={() => setModalVisible(true)} />,
          }}
          listeners={{ tabPress: e => { e.preventDefault(); }, }}
        />
        <Tabs.Screen
          name="reports"
          options={{
            title: 'Reports',
            tabBarIcon: ({ color }) => <Feather name="pie-chart" size={26} color={color} />,
          }}
        />
        {/* --- MODIFIED PART --- */}
        <Tabs.Screen
          name="investments" // Changed from "profile"
          options={{
            title: 'Investments', // Changed title
            tabBarIcon: ({ color }) => <Feather name="trending-up" size={26} color={color} />, // Changed icon
          }}
        />
        {/* The 'profile' screen is removed from tabs */}
      </Tabs>

      <AddTransactionModal
        isVisible={isModalVisible}
        onClose={() => setModalVisible(false)}
      />
    </>
  );
}