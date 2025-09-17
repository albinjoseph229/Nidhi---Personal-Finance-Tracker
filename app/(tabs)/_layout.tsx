import { FontAwesome } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#007BFF',
        // Setting headerShown to false here can be cleaner 
        // if the parent Stack navigator is already showing a header.
        // Or keep it true if you want a header specific to the tabs.
        headerShown: true, 
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <FontAwesome name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Reports',
          tabBarIcon: ({ color, size }) => <FontAwesome name="pie-chart" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <FontAwesome name="cog" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}