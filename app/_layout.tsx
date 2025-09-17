import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { DataProvider } from './context/DataContext'; // 👈 1. Import your DataProvider

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    // 2. Wrap everything with the DataProvider
    <DataProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          {/* I've updated "modal" to "add-expense" to match your app's screen */}
          <Stack.Screen name="add-expense" options={{ presentation: 'modal', title: 'Add Expense' }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </DataProvider>
  );
}