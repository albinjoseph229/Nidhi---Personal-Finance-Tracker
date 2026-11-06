// In app/(tabs)/_layout.tsx
import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React, { useState } from 'react';
import { TouchableOpacity } from 'react-native';
import { AddTransactionModal } from '../../components/AddTransactionModal';
import { useTheme } from '../../context/ThemeContext';
import { useThemeColor } from '../../hooks/use-theme-color';

const AddTransactionButton = ({ onPress }: { onPress: () => void }) => {
  const { theme, accentColor } = useTheme();
  const shadowColor = useThemeColor({}, 'text');

  // ✅ Use the *results* of the hooks in your conditional logic.
  const buttonBackgroundColor = accentColor;
  const iconColor = '#FFFFFF';

  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        position: 'absolute',
        bottom: 24,
        alignSelf: 'center', // centers horizontally
        justifyContent: 'center',
        alignItems: 'center',
        width: 58,
        height: 58,
        borderRadius: 29,
        backgroundColor: buttonBackgroundColor,
        shadowColor: shadowColor,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: theme === 'light' ? 0.22 : 0.35,
        shadowRadius: 3.84,
        elevation: 5,
      }}>
      <Feather name="plus" size={30} color={iconColor} />
    </TouchableOpacity>
  );
};

export default function TabLayout() {
  const { theme, accentColor } = useTheme();
  const cardColor = useThemeColor({}, 'card');
  const inactiveTabColor = useThemeColor({}, 'tabIconDefault');
  const shadowColor = useThemeColor({}, 'text');
  const [isModalVisible, setModalVisible] = useState(false);

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: true,
          tabBarActiveTintColor: accentColor,
          tabBarInactiveTintColor: inactiveTabColor,
          tabBarStyle: {
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            elevation: 0,
            backgroundColor: cardColor,
            height: 76,
            paddingBottom: 10,
            borderTopWidth: 0,
            shadowColor: shadowColor,
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: theme === 'light' ? 0.1 : 0,
            shadowRadius: 3.84,
          },
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '600',
            marginTop: 2,
          },
          tabBarItemStyle: {
            paddingTop: 7,
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
            tabBarButton: () => (
              <AddTransactionButton onPress={() => setModalVisible(true)} />
            ),
          }}
          listeners={{ tabPress: e => e.preventDefault() }}
        />
        <Tabs.Screen
          name="reports"
          options={{
            title: 'Reports',
            tabBarIcon: ({ color }) => <Feather name="pie-chart" size={26} color={color} />,
          }}
        />
        <Tabs.Screen
          name="investments"
          options={{
            title: 'Investments',
            tabBarIcon: ({ color }) => <Feather name="trending-up" size={26} color={color} />,
          }}
        />
      </Tabs>

      <AddTransactionModal
        isVisible={isModalVisible}
        onClose={() => setModalVisible(false)}
      />
    </>
  );
}