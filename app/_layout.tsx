import { Stack } from 'expo-router';
import { AppProvider } from '../context/AppContext'; // Import the provider

export default function RootLayout() {
  return (
    <AppProvider>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="add-expense" options={{ presentation: 'modal', title: 'Add Expense' }} />
        <Stack.Screen name="set-budget" options={{ presentation: 'modal', title: 'Set Budget' }} />
        
        {/* Add this line for the new calculator screen */}
        <Stack.Screen 
          name="calculator" 
          options={{ 
            presentation: 'modal', 
            headerShown: false 
          }} 
        />
      </Stack>
    </AppProvider>
  );
}