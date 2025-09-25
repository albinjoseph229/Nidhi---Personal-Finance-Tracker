// In app/_layout.tsx

import { Stack } from 'expo-router';
import { LockScreen } from '../components/LockScreen'; // Import the LockScreen
import { AppProvider } from '../context/AppContext';
import { AuthProvider, useAuth } from '../context/AuthContext'; // Import AuthProvider and useAuth
import { ThemeProvider } from '../context/ThemeContext';

// This new component will decide whether to show the app or the lock screen
function AppContent() {
  const { isAppLockEnabled, isAuthenticated } = useAuth();
  
  // Show the lock screen if the feature is enabled AND the user is not authenticated
  if (isAppLockEnabled && !isAuthenticated) {
    return <LockScreen />;
  }

  // Otherwise, show the main app
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="add-expense" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="add-income" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="add-investment" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="set-budget" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="financial-report" options={{ presentation: 'modal', headerShown: false }} />
    </Stack>
  );
}


export default function RootLayout() {
  return (
    <ThemeProvider>
      <AppProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </AppProvider>
    </ThemeProvider>
  );
}