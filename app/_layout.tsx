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

function AppContent() {
  const { isAppLockEnabled, isAuthenticated } = useAuth();
  const { theme, isLoading } = useTheme();
  
  // Ensure theme is valid, fallback to light
  const currentTheme: Theme = theme === 'dark' ? 'dark' : 'light';
  const backgroundColor = Colors[currentTheme].background;
  
  // Show loading screen while theme is being loaded
  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor }]}>
        <StatusBar style={currentTheme === 'dark' ? 'light' : 'dark'} backgroundColor={backgroundColor} />
        <ActivityIndicator size="large" color={Colors[currentTheme].text} />
      </View>
    );
  }
  
  if (isAppLockEnabled && !isAuthenticated) {
    return (
      <View style={[styles.container, { backgroundColor }]}>
        <StatusBar style={currentTheme === 'dark' ? 'light' : 'dark'} backgroundColor={backgroundColor} />
        <LockScreen />
      </View>
    );
  }
  
  // Screen options that update with theme
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
          
          {/* Modal screens with different animations */}
          <Stack.Screen name="add-expense" options={modalOptionsBottom} />
          <Stack.Screen name="add-income" options={modalOptionsBottom} />
          <Stack.Screen name="add-investment" options={modalOptionsBottom} />
          <Stack.Screen name="set-budget" options={modalOptionsBottom} />
          <Stack.Screen name="financial-report" options={modalOptionsRight} />
          <Stack.Screen name="settings" options={modalOptionsRight} />
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
      <AppProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </AppProvider>
    </ThemeProvider>
  );
}