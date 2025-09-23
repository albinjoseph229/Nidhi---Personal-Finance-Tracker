import { Stack } from 'expo-router';
import { AppProvider } from '../context/AppContext'; // Import the provider
import { ThemeProvider } from '../context/ThemeContext';

export default function RootLayout() {
  return (
    <ThemeProvider>
    <AppProvider>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="add-expense" options={{ presentation: 'modal', title: 'Add Expense',headerShown: false  }} />
        <Stack.Screen name="set-budget" options={{ presentation: 'modal', title: 'Set Budget',headerShown: false  }} />
        <Stack.Screen name="add-income" options={{ presentation: 'modal', title: 'Add Income',headerShown: false  }} />

      </Stack>
    </AppProvider>
    </ThemeProvider>
  );
}