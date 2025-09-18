import { FontAwesome } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: '#4CAF50', // A nice green color for the active icon
        tabBarInactiveTintColor: '#9E9E9E', // A gray color for inactive icons
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 0,
          elevation: 10,
          height: 60,
          paddingBottom: 5,
        },
        tabBarShowLabel: false, // Hide the text labels
      }}>
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color }) => <FontAwesome name="history" size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'Overview', // "index" is the main dashboard
          tabBarIcon: ({ color }) => <FontAwesome name="home" size={32} color={color} />,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Reports',
          tabBarIcon: ({ color }) => <FontAwesome name="pie-chart" size={28} color={color} />,
        }}
      />
    </Tabs>
  );
}