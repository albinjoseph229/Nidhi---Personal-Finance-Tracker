// app/_layout.tsx
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LockScreen } from '../components/LockScreen';
import { Colors, type Theme } from '../constants/theme';
import { AppProvider } from '../context/AppContext';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import SignInScreen from './sign-in';

function AppContent() {
  const { isAppLockEnabled, isAuthenticated, session, isAuthLoading } = useAuth();
  const { theme, isLoading } = useTheme();
  
  const currentTheme: Theme = theme === 'dark' ? 'dark' : 'light';
  const backgroundColor = Colors[currentTheme].background;
  
  // Show loading screen while auth/theme is loading
  if (isLoading || isAuthLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor }]}>
        <StatusBar style={currentTheme === 'dark' ? 'light' : 'dark'} backgroundColor={backgroundColor} />
        <ActivityIndicator size="large" color={Colors[currentTheme].text} />
      </View>
    );
  }

  // Auth gate: no Supabase session → show sign-in
  if (!session) {
    return (
      <View style={[styles.container, { backgroundColor }]}>
        <StatusBar style={currentTheme === 'dark' ? 'light' : 'dark'} backgroundColor={backgroundColor} />
        <SignInScreen />
      </View>
    );
  }
  
  // Biometric lock gate
  if (isAppLockEnabled && !isAuthenticated) {
    return (
      <View style={[styles.container, { backgroundColor }]}>
        <StatusBar style={currentTheme === 'dark' ? 'light' : 'dark'} backgroundColor={backgroundColor} />
        <LockScreen />
      </View>
    );
  }
  
  const screenOptions = {
    contentStyle: { backgroundColor },
    headerStyle: { backgroundColor },
  };
  
  const modalOptionsBottom = {
    presentation: 'modal' as const,
    headerShown: false,
    animation: 'slide_from_bottom' as const,
    contentStyle: { backgroundColor },
    headerStyle: { backgroundColor },
  };

  const modalOptionsRight = {
    presentation: 'modal' as const,
    headerShown: false,
    animation: 'slide_from_right' as const,
    contentStyle: { backgroundColor },
    headerStyle: { backgroundColor },
  };
  
  return (
    <SafeAreaProvider>
      <View style={[styles.container, { backgroundColor }]}>
        <StatusBar style={currentTheme === 'dark' ? 'light' : 'dark'} backgroundColor={backgroundColor} />
        <Stack screenOptions={screenOptions}>
          <Stack.Screen 
            name="(tabs)" 
            options={{ 
              headerShown: false,
              contentStyle: { backgroundColor }
            }} 
          />
          <Stack.Screen name="add-expense" options={modalOptionsBottom} />
          <Stack.Screen name="add-income" options={modalOptionsBottom} />
          <Stack.Screen name="add-investment" options={modalOptionsBottom} />
          <Stack.Screen name="set-budget" options={modalOptionsBottom} />
          <Stack.Screen name="financial-report" options={modalOptionsRight} />
          <Stack.Screen name="settings" options={modalOptionsRight} />
          <Stack.Screen name="ai-settings" options={modalOptionsRight} />
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        </Stack>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppProvider>
          <AppContent />
        </AppProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}